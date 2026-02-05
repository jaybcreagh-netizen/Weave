jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random()}`,
}))

jest.mock('@/db', () => {
  const { Database } = require('@nozbe/watermelondb')
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
  const schema = require('@/db/schema').default
  const migrations = require('@/db/migrations').default
  const Friend = require('@/db/models/Friend').default
  const FriendMemoryCandidate = require('@/db/models/FriendMemoryCandidate').default

  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: 'test-db-memory-candidate-service',
    extraLokiOptions: {
      autosave: false,
    },
  })

  const database = new Database({
    adapter,
    modelClasses: [Friend, FriendMemoryCandidate],
  })

  return { database }
})

import { database } from '@/db'
import FriendModel from '@/db/models/Friend'
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate'
import {
  cleanupReviewedMemoryCandidates,
  dismissAllPendingMemoryCandidates,
} from '../memory-candidate.service'

describe('memory-candidate.service', () => {
  beforeEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase()
    })
  })

  async function createFriend(name: string): Promise<FriendModel> {
    let created!: FriendModel
    await database.write(async () => {
      created = await database.get<FriendModel>('friends').create(record => {
        record.name = name
        record.dunbarTier = 'CloseFriends'
        record.weaveScore = 50
        record.archetype = 'Emperor'
      })
    })
    return created
  }

  async function createCandidate(
    friendId: string,
    status: 'pending' | 'approved' | 'dismissed',
    updatedAt: Date,
    reviewedAt?: number
  ): Promise<FriendMemoryCandidate> {
    let created!: FriendMemoryCandidate
    await database.write(async () => {
      created = await database.get<FriendMemoryCandidate>('friend_memory_candidates').create(record => {
        record.friendId = friendId
        record.type = 'context'
        record.title = `Candidate ${status}`
        record.content = 'Some memory candidate content'
        record.source = 'journal_signal'
        record.fingerprint = `${friendId}-${status}-${Math.random()}`
        record.status = status
        record.reviewedAt = reviewedAt
        record.updatedAt = updatedAt
      })
    })
    return created
  }

  it('dismisses all pending candidates for a friend', async () => {
    const friend = await createFriend('Alex')
    await createCandidate(friend.id, 'pending', new Date('2026-02-05T10:00:00.000Z'))
    await createCandidate(friend.id, 'pending', new Date('2026-02-05T10:00:00.000Z'))
    await createCandidate(friend.id, 'approved', new Date('2026-02-05T10:00:00.000Z'), Date.now())

    const dismissedCount = await dismissAllPendingMemoryCandidates(friend.id)
    expect(dismissedCount).toBe(2)

    const candidates = await database.get<FriendMemoryCandidate>('friend_memory_candidates').query().fetch()
    const pending = candidates.filter(candidate => candidate.status === 'pending')
    const dismissed = candidates.filter(candidate => candidate.status === 'dismissed')

    expect(pending).toHaveLength(0)
    expect(dismissed).toHaveLength(2)
    dismissed.forEach(candidate => {
      expect(typeof candidate.reviewedAt).toBe('number')
    })
  })

  it('removes only stale reviewed candidates during cleanup', async () => {
    const friend = await createFriend('Taylor')
    const now = new Date('2026-02-05T12:00:00.000Z').getTime()
    const staleReviewedAt = now - (60 * 24 * 60 * 60 * 1000)
    const recentReviewedAt = now - (5 * 24 * 60 * 60 * 1000)

    await createCandidate(friend.id, 'approved', new Date(staleReviewedAt), staleReviewedAt)
    await createCandidate(friend.id, 'dismissed', new Date(staleReviewedAt), staleReviewedAt)
    await createCandidate(friend.id, 'approved', new Date(recentReviewedAt), recentReviewedAt)
    await createCandidate(friend.id, 'pending', new Date(staleReviewedAt))

    const removed = await cleanupReviewedMemoryCandidates(now, 30)
    expect(removed).toBe(2)

    const remaining = await database.get<FriendMemoryCandidate>('friend_memory_candidates').query().fetch()
    const statuses = remaining.map(candidate => candidate.status).sort()

    expect(remaining).toHaveLength(2)
    expect(statuses).toEqual(['approved', 'pending'])
  })
})
