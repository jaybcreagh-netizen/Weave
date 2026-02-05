import { Model } from '@nozbe/watermelondb'
import { date, field, readonly, relation, text } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model'
import Friend from './Friend'

export type FriendMemoryType =
  | 'interest'
  | 'preference'
  | 'upcoming'
  | 'milestone'
  | 'activity_win'
  | 'avoid'
  | 'context'
  | 'general'

export type FriendMemorySource = 'manual' | 'journal_ai' | 'oracle_action' | 'imported'

export default class FriendMemory extends Model {
  static table = 'friend_memories'

  static associations: Associations = {
    friends: { type: 'belongs_to', key: 'friend_id' },
  }

  @text('friend_id') friendId!: string
  @relation('friends', 'friend_id') friend!: Friend

  @text('type') type!: FriendMemoryType
  @text('title') title!: string
  @text('content') content!: string
  @text('source') source!: FriendMemorySource
  @text('source_entry_id') sourceEntryId?: string
  @text('tags_json') tagsRaw?: string
  @field('confidence') confidence?: number
  @field('effective_date') effectiveDate?: number
  @field('expires_at') expiresAt?: number
  @field('is_archived') isArchived!: boolean

  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

  get tags(): string[] {
    if (!this.tagsRaw) return []
    try {
      const parsed = JSON.parse(this.tagsRaw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(tag => typeof tag === 'string')
    } catch {
      return []
    }
  }
}
