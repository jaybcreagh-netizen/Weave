import { Model } from '@nozbe/watermelondb'
import { field, date, children, text, writer, readonly } from '@nozbe/watermelondb/decorators'

export default class Friend extends Model {
  static table = 'friends'

  static associations: any = {
    interaction_friends: { type: 'has_many', foreignKey: 'friend_id' }
  }

  @children('interaction_friends') interactionFriends

  @text('name') name!: string
  @field('dunbar_tier') dunbarTier!: string
  @text('archetype') archetype!: string
  @field('weave_score') weaveScore!: number
  @date('last_updated') lastUpdated!: Date
  @readonly @date('created_at') createdAt!: Date

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

}
