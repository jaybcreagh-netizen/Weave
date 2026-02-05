jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random()}`,
}))

jest.mock('@/shared/services/analytics.service', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    MEMORY_CANDIDATE_CREATED: 'memory_candidate_created',
    MEMORY_CANDIDATE_APPROVED: 'memory_candidate_approved',
    MEMORY_CANDIDATE_DISMISSED: 'memory_candidate_dismissed',
  },
}))

jest.mock('@/shared/utils/Logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}))

jest.mock('@/shared/services/logger.service', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('@/modules/interactions/services/suggestion-engine', () => ({
  generateSuggestion: jest.fn(),
}))

jest.mock('@/modules/interactions/services/guaranteed-suggestions.service', () => ({
  generateGuaranteedSuggestions: jest.fn(() => []),
}))

jest.mock('@/modules/interactions/services/suggestion-storage.service', () => ({
  getDismissedSuggestions: jest.fn(async () => new Map()),
}))

jest.mock('@/modules/intelligence/services/orchestrator.service', () => ({
  calculateCurrentScore: jest.fn((friend: { weaveScore?: number }) => friend.weaveScore || 0),
}))

jest.mock('@/modules/intelligence/services/social-season/season-suggestions.service', () => ({
  filterSuggestionsBySeason: jest.fn((suggestions: any[]) => suggestions),
  getSeasonSuggestionConfig: jest.fn(() => ({ maxDaily: 3 })),
}))

jest.mock('@/modules/intelligence/services/social-season/season-analytics.service', () => ({
  SeasonAnalyticsService: {
    trackSuggestionsShown: jest.fn(async () => undefined),
  },
}))

jest.mock('@/shared/utils/time-aware-filter', () => ({
  filterSuggestionsByTime: jest.fn((suggestions: any[]) => suggestions),
}))

jest.mock('@/modules/insights/services/portfolio.service', () => ({
  generatePortfolioInsights: jest.fn(() => null),
  analyzeArchetypeBalance: jest.fn(() => ({})),
}))

jest.mock('@/modules/insights/services/prediction.service', () => ({
  generateProactiveSuggestions: jest.fn(() => []),
}))

jest.mock('@/modules/insights/services/pattern.service', () => ({
  isPatternReliable: jest.fn(() => false),
  analyzeInteractionPattern: jest.fn(() => ({})),
}))

jest.mock('@/modules/interactions/services/suggestion-system/SuggestionCandidateService', () => ({
  SuggestionCandidateService: {
    getCandidates: jest.fn(async () => []),
  },
}))

jest.mock('@/modules/interactions/services/suggestion-system/SuggestionDataLoader', () => ({
  SuggestionDataLoader: {
    loadContextForCandidates: jest.fn(async () => new Map()),
  },
}))

jest.mock('@/modules/interactions/services/suggestion-system/SuggestionDiversifier', () => ({
  selectDiverseSuggestions: jest.fn((suggestions: any[]) => suggestions),
}))

jest.mock('@/modules/interactions/services/suggestion-engine/generators/TriageGenerator', () => ({
  TriageGenerator: {
    apply: jest.fn(async (suggestions: any[]) => suggestions),
  },
}))

jest.mock('@/modules/interactions/services/suggestion-engine/generators/WeeklyReflectionGenerator', () => ({
  WeeklyReflectionGenerator: {
    generate: jest.fn(async () => null),
  },
}))

jest.mock('@/modules/interactions/services/suggestion-engine/generators/SignalDrivenGenerator', () => ({
  SignalDrivenGenerator: {
    generate: jest.fn(async () => []),
  },
}))

jest.mock('@/modules/relationships/services/memory-life-event.service', () => ({
  archiveExpiredFriendMemories: jest.fn(async () => 0),
  buildLifeEventPrefillFromMemory: jest.fn(() => null),
}))

jest.mock('@/db', () => {
  const { Database } = require('@nozbe/watermelondb')
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
  const schema = require('@/db/schema').default
  const migrations = require('@/db/migrations').default
  const Friend = require('@/db/models/Friend').default
  const FriendMemory = require('@/db/models/FriendMemory').default
  const FriendMemoryCandidate = require('@/db/models/FriendMemoryCandidate').default

  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: 'test-db-memory-roadmap',
    extraLokiOptions: {
      autosave: false,
    },
  })

  const database = new Database({
    adapter,
    modelClasses: [Friend, FriendMemory, FriendMemoryCandidate],
  })

  return { database }
})

import { database } from '@/db'
import FriendModel from '@/db/models/Friend'
import FriendMemory from '@/db/models/FriendMemory'
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate'
import { SmartAction } from '@/modules/oracle/services/types'
import { Suggestion } from '@/shared/types/common'
import { memoryBridgeService } from '@/modules/journal/services/memory-bridge.service'
import {
  loadFriendMemoryProfiles,
  applyMemoryAwareScoring,
} from '@/modules/interactions/services/suggestion-provider.service'

describe('memory roadmap integration', () => {
  beforeEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase()
    })
  })

  it('creates a candidate from journal action and applies approved memory to suggestion scoring', async () => {
    let friend!: FriendModel

    await database.write(async () => {
      friend = await database.get<FriendModel>('friends').create(record => {
        record.name = 'Alex'
        record.dunbarTier = 'CloseFriends'
        record.weaveScore = 58
        record.archetype = 'Emperor'
      })
    })

    const action: SmartAction = {
      type: 'add_memory',
      confidence: 0.91,
      label: 'Note: Seattle trip next week',
      data: {
        friendId: friend.id,
        note: 'Trip to Seattle next week. Book dinner reservations.',
      },
    }

    const createdCount = await memoryBridgeService.ingestSmartActions(
      { id: 'entry-1' } as any,
      [friend],
      [action],
    )

    expect(createdCount).toBe(1)

    const candidates = await database
      .get<FriendMemoryCandidate>('friend_memory_candidates')
      .query()
      .fetch()

    expect(candidates).toHaveLength(1)
    expect(candidates[0].status).toBe('pending')

    const candidate = candidates[0]

    await database.write(async () => {
      await database.get<FriendMemory>('friend_memories').create(record => {
        record.friendId = friend.id
        record.type = candidate.type
        record.title = candidate.title
        record.content = candidate.content
        record.source = 'journal_ai'
        record.sourceEntryId = candidate.sourceEntryId
        record.isArchived = false
        record.updatedAt = new Date()
      })

      await candidate.update(record => {
        record.status = 'approved'
        record.reviewedAt = Date.now()
        record.updatedAt = new Date()
      })
    })

    const profiles = await loadFriendMemoryProfiles([friend.id])

    const baseSuggestion: Suggestion = {
      id: 's-1',
      type: 'connect',
      friendId: friend.id,
      friendName: friend.name,
      title: 'Make a plan',
      subtitle: 'A gentle check-in could help.',
      icon: 'Calendar',
      urgency: 'medium',
      category: 'maintain',
      action: {
        type: 'plan',
      },
      createdAt: new Date(),
      dismissible: true,
    }

    const adjusted = applyMemoryAwareScoring([baseSuggestion], profiles)[0]

    expect(adjusted.urgency).toBe('high')
    expect(adjusted.category).toBe('life-event')
    expect(adjusted.subtitle).toContain('You logged something upcoming')
  })
})
