import { addDays, addMonths, startOfDay } from 'date-fns'
import type { LifeEventType } from '@/db/models/LifeEvent'
import type FriendMemory from '@/db/models/FriendMemory'
import type { FriendMemoryType } from '@/db/models/FriendMemory'
import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import { detectLifeEvents } from './life-event-detection'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * ONE_DAY_MS
const MONTH_NAMES_PATTERN = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

type MemoryLike = Pick<FriendMemory, 'type' | 'title' | 'content'> & {
  effectiveDate?: number | null
}

export interface MemoryTemporalMetadata {
  effectiveDate?: number
  expiresAt?: number
}

export interface MemoryLifeEventPrefill {
  eventType?: LifeEventType
  title?: string
  notes?: string
  eventDate?: string
  source: 'memory'
}

interface TemporalMetadataOptions {
  selectedEffectiveDate?: number | null
  existingEffectiveDate?: number | null
  now?: Date
}

function parsePossibleDate(value: string, now: Date): Date | null {
  const text = value.toLowerCase()

  const isoMatch = value.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/)
  if (isoMatch?.[1]) {
    const parsed = new Date(isoMatch[1])
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed)
  }

  const slashMatch = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (slashMatch) {
    const month = Number(slashMatch[1])
    const day = Number(slashMatch[2])
    const yearRaw = slashMatch[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = now.getFullYear()
      if (yearRaw) {
        year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
      }
      const parsed = new Date(year, month - 1, day)
      if (!Number.isNaN(parsed.getTime())) {
        const normalized = startOfDay(parsed)
        if (!yearRaw && normalized.getTime() < startOfDay(now).getTime() - ONE_DAY_MS) {
          return startOfDay(new Date(year + 1, month - 1, day))
        }
        return normalized
      }
    }
  }

  const monthRegex = new RegExp(`\\b${MONTH_NAMES_PATTERN}\\s+\\d{1,2}(?:,?\\s*\\d{4})?\\b`, 'i')
  const monthMatch = value.match(monthRegex)
  if (monthMatch?.[0]) {
    const withYear = /\d{4}/.test(monthMatch[0]) ? monthMatch[0] : `${monthMatch[0]} ${now.getFullYear()}`
    const parsed = new Date(withYear)
    if (!Number.isNaN(parsed.getTime())) {
      const normalized = startOfDay(parsed)
      if (!/\d{4}/.test(monthMatch[0]) && normalized.getTime() < startOfDay(now).getTime() - ONE_DAY_MS) {
        return startOfDay(new Date(now.getFullYear() + 1, normalized.getMonth(), normalized.getDate()))
      }
      return normalized
    }
  }

  if (text.includes('tomorrow')) return startOfDay(addDays(now, 1))
  if (text.includes('next week')) return startOfDay(addDays(now, 7))
  if (text.includes('next month')) return startOfDay(addMonths(now, 1))

  return null
}

function fallbackTitle(content: string): string {
  const sentence = content.split(/[.!?]/)[0]?.trim() || ''
  if (!sentence) return 'Life Event'
  return sentence.length > 80 ? `${sentence.slice(0, 77)}...` : sentence
}

export function deriveMemoryTemporalMetadata(
  type: FriendMemoryType,
  title: string,
  content: string,
  options: TemporalMetadataOptions = {}
): MemoryTemporalMetadata {
  const { selectedEffectiveDate, existingEffectiveDate, now = new Date() } = options
  const text = `${title} ${content}`.trim()
  const effectiveDate = typeof selectedEffectiveDate === 'number'
    ? selectedEffectiveDate
    : typeof existingEffectiveDate === 'number'
      ? existingEffectiveDate
    : (parsePossibleDate(text, now)?.getTime())

  let expiresAt: number | undefined
  if (type === 'upcoming' && effectiveDate) {
    expiresAt = effectiveDate + (7 * ONE_DAY_MS)
  } else if (type === 'context') {
    expiresAt = startOfDay(now).getTime() + NINETY_DAYS_MS
  }

  return {
    effectiveDate,
    expiresAt,
  }
}

export function buildLifeEventPrefillFromMemory(memory: MemoryLike): MemoryLifeEventPrefill | null {
  if (memory.type !== 'upcoming' && memory.type !== 'milestone') return null

  const title = memory.title?.trim()
  const content = memory.content?.trim() || ''
  const text = `${title || ''} ${content}`.trim()
  if (!text) return null

  const detections = detectLifeEvents(text)
  const detectedType = detections[0]?.type

  const temporal = deriveMemoryTemporalMetadata(memory.type, title || '', content, {
    existingEffectiveDate: memory.effectiveDate,
  })
  const eventType: LifeEventType = detectedType
    || (memory.type === 'milestone' ? 'celebration' : 'other')

  return {
    eventType,
    title: title || fallbackTitle(content),
    notes: content || undefined,
    eventDate: temporal.effectiveDate ? new Date(temporal.effectiveDate).toISOString() : undefined,
    source: 'memory',
  }
}

export function canSuggestLifeEventFromMemory(memory: MemoryLike): boolean {
  return !!buildLifeEventPrefillFromMemory(memory)
}

export async function archiveExpiredFriendMemories(now: number = Date.now()): Promise<number> {
  const expiredMemories = await database.get<FriendMemory>('friend_memories')
    .query(
      Q.where('is_archived', false),
      Q.where('expires_at', Q.lte(now)),
    )
    .fetch()

  if (!expiredMemories.length) return 0

  await database.write(async () => {
    for (const memory of expiredMemories) {
      await memory.update(record => {
        record.isArchived = true
        record.updatedAt = new Date()
      })
    }
  })

  return expiredMemories.length
}
