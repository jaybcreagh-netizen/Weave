import { Model, Query } from '@nozbe/watermelondb'
import { field, date, children, text, writer, readonly } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb/Model'
import { Archetype, Tier } from '@/shared/types/common'
import InteractionFriend from './InteractionFriend'

export default class Friend extends Model {
  static table = 'friends'

  static associations: Associations = {
    interaction_friends: { type: 'has_many', foreignKey: 'friend_id' }
  }

  @children('interaction_friends') interactionFriends!: Query<InteractionFriend>

  @text('name') name!: string
  @field('dunbar_tier') dunbarTier!: string

  get tier(): Tier {
    return (this.dunbarTier as Tier) || 'Community'
  }

  @text('archetype') archetype!: Archetype
  @field('weave_score') weaveScore!: number
  @date('last_updated') lastUpdated!: Date
  @readonly @date('created_at') createdAt!: Date

  // Cloud sync fields (v31)
  @field('user_id') userId?: string
  @field('synced_at') syncedAt?: number
  @text('sync_status') customSyncStatus?: 'synced' | 'pending'
  @field('server_updated_at') serverUpdatedAt?: number

  @text('photo_url') photoUrl?: string
  @text('notes') notes?: string

  @field('resilience') resilience!: number
  @field('rated_weaves_count') ratedWeavesCount!: number
  @field('momentum_score') momentumScore!: number
  @date('momentum_last_updated') momentumLastUpdated!: Date
  @field('is_dormant') isDormant!: boolean
  @date('dormant_since') dormantSince?: Date

  // Life events and relationship context
  @text('birthday') birthday?: string // Format: "MM-DD"
  @text('anniversary') anniversary?: string // Format: "MM-DD"
  @text('relationship_type') relationshipType?: string

  // Adaptive decay pattern learning (v21)
  @field('typical_interval_days') typicalIntervalDays?: number
  @field('tolerance_window_days') toleranceWindowDays?: number

  // Learned effectiveness from feedback (v23)
  @text('category_effectiveness') categoryEffectiveness?: string // JSON
  @field('outcome_count') outcomeCount!: number

  // Reciprocity tracking (v25)
  @field('initiation_ratio') initiationRatio!: number // 0 = always friend, 1.0 = always user, 0.5 = balanced
  @text('last_initiated_by') lastInitiatedBy?: string // 'user' | 'friend' | 'mutual'
  @field('consecutive_user_initiations') consecutiveUserInitiations!: number
  @field('total_user_initiations') totalUserInitiations!: number
  @field('total_friend_initiations') totalFriendInitiations!: number

  // Tier intelligence (v36)
  @field('tier_fit_score') tierFitScore?: number // 0-1 score of how well patterns match tier
  @field('tier_fit_last_calculated') tierFitLastCalculated?: number // When tier fit was last calculated
  @text('suggested_tier') suggestedTier?: string // AI-suggested tier based on patterns
  @field('tier_suggestion_dismissed_at') tierSuggestionDismissedAt?: number // When user dismissed suggestion

  // Messaging app integration (v46)
  @text('phone_number') phoneNumber?: string // E.164 format preferred
  @text('email') email?: string
  @text('contact_id') contactId?: string // Device contact ID for re-sync
  @text('preferred_messaging_app') preferredMessagingApp?: 'whatsapp' | 'telegram' | 'sms' | 'email'

}
