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

  // Friend Linking (v46) - Connect to Weave user accounts
  @text('linked_user_id') linkedUserId?: string // Supabase user_profiles.id
  @text('link_status') linkStatus?: 'pending_sync' | 'pending_sent' | 'pending_received' | 'linked' | 'declined'
  @field('linked_at') linkedAt?: number // When link was established
  @text('server_link_id') serverLinkId?: string // Server-side friend_links.id for updates

  // Messaging app integration (v47)
  @text('phone_number') phoneNumber?: string // E.164 format preferred
  @text('email') email?: string
  @text('contact_id') contactId?: string // Device contact ID for re-sync
  @text('preferred_messaging_app') preferredMessagingApp?: 'whatsapp' | 'telegram' | 'sms' | 'email'

  // v53: Journal intelligence feedback
  @text('detected_themes_raw') detectedThemesRaw?: string
  @field('last_journal_sentiment') lastJournalSentiment?: number // -2 to +2
  @field('journal_mention_count') journalMentionCount?: number
  @field('reflection_activity_score') reflectionActivityScore?: number
  @field('needs_attention') needsAttention?: boolean

  // v53: Communication patterns (for triage)
  @field('avg_weave_duration_minutes') avgWeaveDurationMinutes?: number
  @text('preferred_weave_types_raw') preferredWeaveTypesRaw?: string
  @text('best_time_of_day') bestTimeOfDay?: 'morning' | 'afternoon' | 'evening'
  @field('best_day_of_week') bestDayOfWeek?: number // 0-6

  // v53: Topic evolution
  @text('topic_clusters_raw') topicClustersRaw?: string
  @text('topic_trend') topicTrend?: 'deepening' | 'stable' | 'surface'

  // v53: Reconnection tracking
  @field('reconnection_attempts') reconnectionAttempts?: number
  @field('successful_reconnections') successfulReconnections?: number
  @field('last_reconnection_date') lastReconnectionDate?: number

  /** Get detected themes as array */
  get detectedThemes(): string[] {
    if (!this.detectedThemesRaw) return []
    try {
      return JSON.parse(this.detectedThemesRaw)
    } catch {
      return []
    }
  }

  /** Get preferred weave types as array */
  get preferredWeaveTypes(): string[] {
    if (!this.preferredWeaveTypesRaw) return []
    try {
      return JSON.parse(this.preferredWeaveTypesRaw)
    } catch {
      return []
    }
  }

  /** Get topic clusters as record */
  get topicClusters(): Record<string, number> {
    if (!this.topicClustersRaw) return {}
    try {
      return JSON.parse(this.topicClustersRaw)
    } catch {
      return {}
    }
  }

  /** Check if friend has concerning journal sentiment */
  get hasConcerningSentiment(): boolean {
    return this.lastJournalSentiment !== undefined && this.lastJournalSentiment <= -1
  }

  /** Calculate reconnection success rate */
  get reconnectionSuccessRate(): number {
    const attempts = this.reconnectionAttempts ?? 0
    const successes = this.successfulReconnections ?? 0
    if (attempts === 0) return 0
    return successes / attempts
  }

}
