import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, lazy, children } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { type StructuredReflection } from '../../components/types'

export default class Interaction extends Model {
  static table = 'interactions'

  static associations = {
    interaction_friends: { type: 'has_many', foreignKey: 'interaction_id' }
  }

  @children('interaction_friends') interactionFriends

  @date('interaction_date') interactionDate!: Date
  @field('interaction_type') interactionType!: string
  @field('duration') duration?: string
  @field('vibe') vibe?: string
  @text('note') note?: string
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

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

  // Getter for parsed reflection
  get reflection(): StructuredReflection | undefined {
    if (!this.reflectionJSON) return undefined
    try {
      return JSON.parse(this.reflectionJSON)
    } catch {
      return undefined
    }
  }
}
