import { Model } from '@nozbe/watermelondb'
import { field, date, children, text, writer, readonly } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model'
import { type StructuredReflection } from '@/shared/types/legacy-types'

import InteractionFriend from './InteractionFriend'
import { Query } from '@nozbe/watermelondb'

export default class Interaction extends Model {
  static table = 'interactions'

  static associations: Associations = {
    interaction_friends: { type: 'has_many', foreignKey: 'interaction_id' }
  }

  @children('interaction_friends') interactionFriends!: Query<InteractionFriend>

  @date('interaction_date') interactionDate!: Date
  @field('interaction_type') interactionType!: string
  @field('duration') duration?: string
  @field('vibe') vibe?: string
  @text('note') note?: string

  get notes(): string | undefined {
    return this.note
  }

  set notes(value: string | undefined) {
    this.note = value
  }
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

  // Cloud sync fields (v31)
  @field('user_id') userId?: string
  @field('synced_at') syncedAt?: number
  @text('sync_status') customSyncStatus?: string
  @field('server_updated_at') serverUpdatedAt?: number

  @text('activity') activity!: string
  @text('status') status!: string // 'planned' | 'pending_confirm' | 'completed' | 'cancelled' | 'missed'
  @text('mode') mode!: string

  // NEW: Simplified interaction category system
  @field('interaction_category') interactionCategory?: string

  // NEW: Structured reflection data (stored as JSON)
  @text('reflection') reflectionJSON?: string

  // v17: Custom title for weaves
  @text('title') title?: string

  // v17: Location (Phase 1 - text only, no coordinates yet)
  @text('location') location?: string

  // v17: Plan lifecycle tracking
  @field('completion_prompted_at') completionPromptedAt?: number

  // v18: Calendar integration
  @text('calendar_event_id') calendarEventId?: string

  // v24: Event importance for special occasions
  @field('event_importance') eventImportance?: string // 'low' | 'medium' | 'high' | 'critical'

  // v25: Reciprocity tracking
  @field('initiator') initiator?: string // 'user' | 'friend' | 'mutual'

  // Getter for parsed reflection
  get reflection(): StructuredReflection | undefined {
    if (!this.reflectionJSON) return undefined
    try {
      return JSON.parse(this.reflectionJSON)
    } catch {
      return undefined
    }
  }

  async prepareDestroyWithChildren() {
    const friends = await this.interactionFriends.fetch();
    const friendsToDelete = friends.map((friend: any) => friend.prepareDestroyPermanently());
    await this.batch(...friendsToDelete);
    return this.prepareDestroyPermanently()
  }
}
