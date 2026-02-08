import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'
import FriendModel from '@/db/models/Friend'
import FriendMemory, { FriendMemoryType } from '@/db/models/FriendMemory'
import FriendMemoryCandidate, { FriendMemoryCandidateSource } from '@/db/models/FriendMemoryCandidate'
import { SignalExtractionResult } from './signal-extractor'
import { ExtractedThread } from './thread-extractor'
import { SmartAction } from '@/modules/oracle'
import { logger } from '@/shared/services/logger.service'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service'

interface CandidateDraft {
  friendId: string
  type: FriendMemoryType
  title: string
  content: string
  source: FriendMemoryCandidateSource
  sourceEntryId?: string
  confidence?: number
}

const SIGNAL_CONFIDENCE_FLOOR = 0.58

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFingerprint(friendId: string, type: FriendMemoryType, title: string, content: string): string {
  const normalizedTitle = normalizeText(title).slice(0, 80)
  const normalizedContent = normalizeText(content).slice(0, 120)
  return `${friendId}|${type}|${normalizedTitle}|${normalizedContent}`
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).split(' ').filter(Boolean))
  const bTokens = new Set(normalizeText(b).split(' ').filter(Boolean))
  if (aTokens.size === 0 || bTokens.size === 0) return 0

  let overlap = 0
  aTokens.forEach(token => {
    if (bTokens.has(token)) overlap += 1
  })

  return overlap / Math.max(aTokens.size, bTokens.size)
}

function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`
}

function inferTypeFromThread(topic: string, sentiment: ExtractedThread['sentiment']): FriendMemoryType {
  const normalizedTopic = normalizeText(topic)
  if (/\b(birthday|anniversary|wedding|graduation|baby|new job)\b/.test(normalizedTopic)) {
    return 'milestone'
  }
  if (/\b(next|plan|soon|upcoming|trip|birthday|wedding|graduation|move|moving|travel)\b/.test(normalizedTopic)) {
    return 'upcoming'
  }
  if (sentiment === 'concern') return 'context'
  if (sentiment === 'positive') return 'activity_win'
  return 'interest'
}

function inferTypeFromNote(note: string): FriendMemoryType {
  const normalized = normalizeText(note)
  if (/\b(prefers|prefer|likes|loves|hates|dislikes|allergic|vegan|vegetarian|gluten|diet)\b/.test(normalized)) {
    return 'preference'
  }
  if (/\b(birthday|wedding|trip|travel|moving|move|new job|graduation|baby)\b/.test(normalized)) {
    return 'upcoming'
  }
  return 'context'
}

function sanitizeTitle(label?: string, fallbackContent?: string): string {
  const cleaned = (label || '').replace(/^note:\s*/i, '').trim()
  if (cleaned) return truncate(cleaned, 80)
  const sentence = (fallbackContent || '').split(/[.!?]/)[0]?.trim() || 'Suggested Memory'
  return truncate(sentence, 80)
}

function sanitizeTopic(topic: string): string {
  return topic
    .replace(/^(about|re:|topic:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

class MemoryBridgeService {
  async ingestSignalsAndThreads(
    entry: JournalEntry,
    friends: FriendModel[],
    signals: SignalExtractionResult,
    extractedThreadsByFriend: Record<string, ExtractedThread[]>
  ): Promise<number> {
    if (!friends.length) return 0

    const drafts: CandidateDraft[] = []
    for (const friend of friends) {
      drafts.push(...this.buildSignalDrafts(friend, signals, entry.id))
      drafts.push(...this.buildThreadDrafts(friend, extractedThreadsByFriend[friend.id] || [], entry.id))
    }

    return await this.persistCandidates(drafts)
  }

  async ingestSmartActions(
    entry: JournalEntry,
    friends: FriendModel[],
    actions: SmartAction[]
  ): Promise<number> {
    if (!actions?.length) return 0

    const drafts: CandidateDraft[] = []

    for (const action of actions) {
      if (action.type !== 'add_memory' && action.type !== 'update_profile') continue

      const note = action.data?.note?.trim()
      if (!note || note.length < 6) continue

      const friend = this.resolveActionFriend(friends, action.data?.friendId)
      if (!friend) continue

      drafts.push({
        friendId: friend.id,
        type: inferTypeFromNote(note),
        title: sanitizeTitle(action.label, note),
        content: truncate(note, 300),
        source: 'journal_action',
        sourceEntryId: entry.id,
        confidence: action.confidence,
      })
    }

    return await this.persistCandidates(drafts)
  }

  private buildSignalDrafts(
    friend: FriendModel,
    signals: SignalExtractionResult,
    entryId: string
  ): CandidateDraft[] {
    if ((signals.confidence ?? 0) < SIGNAL_CONFIDENCE_FLOOR) return []

    const drafts: CandidateDraft[] = []
    const pushDraft = (draft: CandidateDraft) => {
      const fingerprint = getFingerprint(draft.friendId, draft.type, draft.title, draft.content)
      const exists = drafts.some(existing =>
        getFingerprint(existing.friendId, existing.type, existing.title, existing.content) === fingerprint
      )
      if (!exists) drafts.push(draft)
    }

    const emergentThemes = (signals.emergentThemes || []).filter(Boolean).slice(0, 2)
    emergentThemes.forEach(emergentTheme => {
      pushDraft({
        friendId: friend.id,
        type: 'interest',
        title: `Interest: ${truncate(emergentTheme, 60)}`,
        content: `${friend.name} keeps showing up around "${emergentTheme}".`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    })

    if (signals.coreThemes.includes('planning')) {
      pushDraft({
        friendId: friend.id,
        type: 'upcoming',
        title: 'Upcoming plan to remember',
        content: emergentThemes[0]
          ? `Possible upcoming plan with ${friend.name}: ${truncate(emergentThemes[0], 120)}.`
          : `Journal suggests plans are forming with ${friend.name}.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    if (signals.coreThemes.includes('shared_activity')) {
      pushDraft({
        friendId: friend.id,
        type: 'activity_win',
        title: 'Shared activity worked well',
        content: emergentThemes[0]
          ? `Shared activity to remember with ${friend.name}: ${truncate(emergentThemes[0], 120)}.`
          : `Recent journaling highlights positive shared activities with ${friend.name}.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    if (signals.coreThemes.includes('life_transition')) {
      pushDraft({
        friendId: friend.id,
        type: 'milestone',
        title: 'Possible life transition to note',
        content: `${friend.name} may be going through a meaningful transition.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    if (signals.coreThemes.includes('celebration')) {
      pushDraft({
        friendId: friend.id,
        type: 'milestone',
        title: 'Celebration worth tracking',
        content: `Recent journaling suggests a moment worth celebrating with ${friend.name}.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    if (signals.coreThemes.includes('conflict') || signals.dynamics?.tensionDetected) {
      pushDraft({
        friendId: friend.id,
        type: 'context',
        title: 'Sensitive context to keep in mind',
        content: `Journal tone around ${friend.name} suggests extra care may help.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    if (signals.coreThemes.includes('support') || signals.coreThemes.includes('vulnerability') || signals.coreThemes.includes('reconnection')) {
      pushDraft({
        friendId: friend.id,
        type: 'context',
        title: 'Supportive context to remember',
        content: `${friend.name} may value thoughtful emotional follow-up right now.`,
        source: 'journal_signal',
        sourceEntryId: entryId,
        confidence: signals.confidence,
      })
    }

    return drafts.slice(0, 4)
  }

  private buildThreadDrafts(friend: FriendModel, threads: ExtractedThread[], entryId: string): CandidateDraft[] {
    return threads
      .filter(thread => !!thread.topic?.trim())
      .slice(0, 3)
      .map(thread => {
        const topic = sanitizeTopic(thread.topic.trim())
        const sentimentPrefix = thread.sentiment === 'concern'
          ? 'Needs gentle follow-up'
          : thread.sentiment === 'positive'
            ? 'Positive thread'
            : 'Ongoing thread'
        return {
          friendId: friend.id,
          type: inferTypeFromThread(topic, thread.sentiment),
          title: truncate(topic, 80),
          content: `${sentimentPrefix}: ${truncate(topic, 240)}`,
          source: 'journal_thread',
          sourceEntryId: entryId,
          confidence: 0.72,
        } satisfies CandidateDraft
      })
  }

  private resolveActionFriend(friends: FriendModel[], rawFriendId?: string): FriendModel | null {
    const value = rawFriendId?.trim()
    if (!value) return friends.length === 1 ? friends[0] : null

    const byId = friends.find(friend => friend.id === value)
    if (byId) return byId

    const normalizedValue = value.toLowerCase()
    const byName = friends.find(friend => friend.name.toLowerCase() === normalizedValue)
    if (byName) return byName

    return friends.length === 1 ? friends[0] : null
  }

  private async persistCandidates(drafts: CandidateDraft[]): Promise<number> {
    if (!drafts.length) return 0

    const grouped = new Map<string, CandidateDraft[]>()
    for (const draft of drafts) {
      if (!draft.title.trim() || !draft.content.trim()) continue
      const friendDrafts = grouped.get(draft.friendId) || []
      friendDrafts.push(draft)
      grouped.set(draft.friendId, friendDrafts)
    }

    if (!grouped.size) return 0

    const insertable: Array<CandidateDraft & { fingerprint: string }> = []

    for (const [friendId, friendDrafts] of grouped.entries()) {
      const [existingMemories, existingCandidates] = await Promise.all([
        database.get<FriendMemory>('friend_memories')
          .query(Q.where('friend_id', friendId), Q.where('is_archived', false))
          .fetch(),
        database.get<FriendMemoryCandidate>('friend_memory_candidates')
          .query(Q.where('friend_id', friendId))
          .fetch(),
      ])

      const existingFingerprints = new Set(existingCandidates.map(candidate => candidate.fingerprint))
      const localFingerprints = new Set<string>()

      for (const draft of friendDrafts) {
        const fingerprint = getFingerprint(friendId, draft.type, draft.title, draft.content)
        if (existingFingerprints.has(fingerprint) || localFingerprints.has(fingerprint)) continue

        const duplicateMemory = existingMemories.some(memory =>
          memory.type === draft.type &&
          tokenSimilarity(`${memory.title} ${memory.content}`, `${draft.title} ${draft.content}`) >= 0.7
        )
        if (duplicateMemory) continue

        const duplicateCandidate = existingCandidates.some(candidate =>
          candidate.type === draft.type &&
          tokenSimilarity(`${candidate.title} ${candidate.content}`, `${draft.title} ${draft.content}`) >= 0.75
        )
        if (duplicateCandidate) continue

        localFingerprints.add(fingerprint)
        insertable.push({ ...draft, fingerprint })
      }
    }

    if (!insertable.length) return 0

    await database.write(async () => {
      const candidateCollection = database.get<FriendMemoryCandidate>('friend_memory_candidates')
      for (const candidate of insertable) {
        await candidateCollection.create(record => {
          record.friendId = candidate.friendId
          record.type = candidate.type
          record.title = truncate(candidate.title.trim(), 80)
          record.content = truncate(candidate.content.trim(), 300)
          record.source = candidate.source
          record.sourceEntryId = candidate.sourceEntryId
          if (typeof candidate.confidence === 'number') {
            record.confidence = Math.max(0, Math.min(1, candidate.confidence))
          }
          record.fingerprint = candidate.fingerprint
          record.status = 'pending'
          record.updatedAt = new Date()
        })
      }
    })

    logger.info('MemoryBridgeService', 'Created friend memory candidates', { count: insertable.length })

    const sourceCounts = insertable.reduce<Record<string, number>>((acc, candidate) => {
      acc[candidate.source] = (acc[candidate.source] || 0) + 1
      return acc
    }, {})

    trackEvent(AnalyticsEvents.MEMORY_CANDIDATE_CREATED, {
      candidate_count: insertable.length,
      source_counts: sourceCounts,
    })

    return insertable.length
  }
}

export const memoryBridgeService = new MemoryBridgeService()
