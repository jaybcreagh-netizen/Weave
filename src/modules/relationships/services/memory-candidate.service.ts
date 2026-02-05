import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_REVIEWED_RETENTION_DAYS = 45

export async function dismissAllPendingMemoryCandidates(friendId: string): Promise<number> {
  if (!friendId?.trim()) return 0

  const pendingCandidates = await database.get<FriendMemoryCandidate>('friend_memory_candidates')
    .query(
      Q.where('friend_id', friendId),
      Q.where('status', 'pending'),
    )
    .fetch()

  if (!pendingCandidates.length) return 0

  const reviewedAt = Date.now()
  await database.write(async () => {
    for (const candidate of pendingCandidates) {
      await candidate.update(record => {
        record.status = 'dismissed'
        record.reviewedAt = reviewedAt
        record.updatedAt = new Date()
      })
    }
  })

  return pendingCandidates.length
}

export async function cleanupReviewedMemoryCandidates(
  now: number = Date.now(),
  retentionDays: number = DEFAULT_REVIEWED_RETENTION_DAYS
): Promise<number> {
  const cutoff = now - (Math.max(1, retentionDays) * ONE_DAY_MS)

  const reviewedCandidates = await database.get<FriendMemoryCandidate>('friend_memory_candidates')
    .query(
      Q.where('status', Q.oneOf(['approved', 'dismissed'])),
      Q.sortBy('updated_at', Q.asc),
    )
    .fetch()

  const staleCandidates = reviewedCandidates.filter(candidate => {
    const reviewedAt = typeof candidate.reviewedAt === 'number'
      ? candidate.reviewedAt
      : candidate.updatedAt?.getTime?.() || now
    return reviewedAt <= cutoff
  })

  if (!staleCandidates.length) return 0

  await database.write(async () => {
    for (const candidate of staleCandidates) {
      await candidate.destroyPermanently()
    }
  })

  return staleCandidates.length
}
