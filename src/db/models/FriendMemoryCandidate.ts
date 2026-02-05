import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model'
import Friend from './Friend'
import { FriendMemoryType } from './FriendMemory'

export type FriendMemoryCandidateSource = 'journal_signal' | 'journal_thread' | 'journal_action'
export type FriendMemoryCandidateStatus = 'pending' | 'approved' | 'dismissed'

export default class FriendMemoryCandidate extends Model {
  static table = 'friend_memory_candidates'

  static associations: Associations = {
    friends: { type: 'belongs_to', key: 'friend_id' },
  }

  @text('friend_id') friendId!: string
  @relation('friends', 'friend_id') friend!: Friend

  @text('type') type!: FriendMemoryType
  @text('title') title!: string
  @text('content') content!: string
  @text('source') source!: FriendMemoryCandidateSource
  @text('source_entry_id') sourceEntryId?: string

  @field('confidence') confidence?: number
  @text('fingerprint') fingerprint!: string
  @text('status') status!: FriendMemoryCandidateStatus
  @field('reviewed_at') reviewedAt?: number

  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date
}
