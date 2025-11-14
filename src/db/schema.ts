import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 31, // UPDATED: Added user accounts infrastructure (user_id + sync columns for cloud sync & freemium)
  tables: [
    tableSchema({
      name: 'friends',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'dunbar_tier', type: 'string' },
        { name: 'archetype', type: 'string' },
        { name: 'weave_score', type: 'number' },
        { name: 'last_updated', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'resilience', type: 'number', defaultValue: 1.0 },
        { name: 'rated_weaves_count', type: 'number', defaultValue: 0 },
        { name: 'momentum_score', type: 'number', defaultValue: 0 },
        { name: 'momentum_last_updated', type: 'number' },
        { name: 'is_dormant', type: 'boolean', defaultValue: false },
        { name: 'dormant_since', type: 'number', isOptional: true },
        // NEW: Life events and relationship context
        { name: 'birthday', type: 'string', isOptional: true }, // Format: "MM-DD" (month and day only)
        { name: 'anniversary', type: 'string', isOptional: true }, // Format: "MM-DD" (month and day only)
        { name: 'relationship_type', type: 'string', isOptional: true }, // friend, close_friend, family, partner, colleague, acquaintance
        // NEW v21: Adaptive decay pattern learning
        { name: 'typical_interval_days', type: 'number', isOptional: true }, // Learned average days between interactions
        { name: 'tolerance_window_days', type: 'number', isOptional: true }, // Learned tolerance before decay accelerates
        // NEW v23: Learned effectiveness from feedback
        { name: 'category_effectiveness', type: 'string', isOptional: true }, // JSON: Record<category, effectiveness ratio>
        { name: 'outcome_count', type: 'number', defaultValue: 0 }, // How many outcomes measured
        // NEW v25: Reciprocity tracking
        { name: 'initiation_ratio', type: 'number', defaultValue: 0.5 }, // 0 = always friend, 1.0 = always user, 0.5 = balanced
        { name: 'last_initiated_by', type: 'string', isOptional: true }, // 'user' | 'friend' | 'mutual'
        { name: 'consecutive_user_initiations', type: 'number', defaultValue: 0 }, // Streak of user-initiated interactions
        { name: 'total_user_initiations', type: 'number', defaultValue: 0 }, // Total times user initiated
        { name: 'total_friend_initiations', type: 'number', defaultValue: 0 }, // Total times friend initiated
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true }, // Links record to user account
        { name: 'synced_at', type: 'number', isOptional: true }, // Last successful sync timestamp
        { name: 'sync_status', type: 'string', isOptional: true }, // 'pending' | 'synced' | 'conflict'
        { name: 'server_updated_at', type: 'number', isOptional: true }, // Server's last update time
      ]
    }),
    tableSchema({
      name: 'interactions',
      columns: [
        { name: 'interaction_date', type: 'number' },
        { name: 'interaction_type', type: 'string' },
        { name: 'duration', type: 'string', isOptional: true },
        { name: 'vibe', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'activity', type: 'string' },
        { name: 'status', type: 'string' }, // planned, pending_confirm, completed, cancelled, missed
        { name: 'mode', type: 'string' },
        // NEW: Simplified interaction category system
        { name: 'interaction_category', type: 'string', isOptional: true },
        // NEW: Structured reflection data (JSON string)
        { name: 'reflection', type: 'string', isOptional: true },
        // v17: Custom title for weaves
        { name: 'title', type: 'string', isOptional: true },
        // v17: Location (Phase 1 - text only, no coordinates yet)
        { name: 'location', type: 'string', isOptional: true },
        // v17: Plan lifecycle tracking
        { name: 'completion_prompted_at', type: 'number', isOptional: true },
        // v18: Calendar integration
        { name: 'calendar_event_id', type: 'string', isOptional: true },
        // v24: Event importance for special occasions
        { name: 'event_importance', type: 'string', isOptional: true }, // low, medium, high, critical
        // v25: Reciprocity tracking
        { name: 'initiator', type: 'string', isOptional: true }, // 'user' | 'friend' | 'mutual'
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
        name: 'interaction_friends',
        columns: [
            { name: 'interaction_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
            // NEW v31: Accounts and sync infrastructure
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
        ]
    }),
    tableSchema({
      name: 'suggestion_events',
      columns: [
        { name: 'suggestion_id', type: 'string', isIndexed: true }, // e.g., "reflect-abc123"
        { name: 'friend_id', type: 'string', isIndexed: true },
        { name: 'suggestion_type', type: 'string' }, // reflect, drift, deepen, maintain, etc.
        { name: 'urgency', type: 'string' }, // critical, high, medium, low
        { name: 'action_type', type: 'string' }, // log, plan, reflect
        { name: 'event_type', type: 'string' }, // shown, acted, dismissed, expired
        { name: 'event_timestamp', type: 'number' },
        { name: 'friend_score_at_event', type: 'number', isOptional: true },
        { name: 'days_since_last_interaction', type: 'number', isOptional: true },
        { name: 'resulting_interaction_id', type: 'string', isOptional: true }, // If acted upon
        { name: 'time_to_action_minutes', type: 'number', isOptional: true }, // Time from shown to acted
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'intentions',
      columns: [
        { name: 'description', type: 'string', isOptional: true },
        { name: 'interaction_category', type: 'string', isOptional: true },
        { name: 'status', type: 'string' }, // active, converted, dismissed, fulfilled
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_reminded_at', type: 'number', isOptional: true },
        // v29: Fulfillment tracking for pattern analysis
        { name: 'linked_interaction_id', type: 'string', isOptional: true }, // Interaction that fulfilled this intention
        { name: 'fulfilled_at', type: 'number', isOptional: true }, // When it was fulfilled
        { name: 'days_to_fulfillment', type: 'number', isOptional: true }, // Time from creation to fulfillment
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'intention_friends',
      columns: [
          { name: 'intention_id', type: 'string', isIndexed: true },
          { name: 'friend_id', type: 'string', isIndexed: true },
          // NEW v31: Accounts and sync infrastructure
          { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
          { name: 'synced_at', type: 'number', isOptional: true },
          { name: 'sync_status', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'user_profile',
      columns: [
        // Social Season State
        { name: 'current_social_season', type: 'string', isOptional: true }, // 'resting' | 'flowing' | 'blooming'
        { name: 'season_last_calculated', type: 'number', isOptional: true },
        { name: 'season_history', type: 'string', isOptional: true }, // JSON: Array<{season, startDate, endDate}>

        // Social Battery
        { name: 'social_battery_current', type: 'number', isOptional: true }, // 1-5 scale
        { name: 'social_battery_last_checkin', type: 'number', isOptional: true },
        { name: 'social_battery_history', type: 'string', isOptional: true }, // JSON: Array<{value, timestamp}>

        // Preferences
        { name: 'battery_checkin_enabled', type: 'boolean', isOptional: true },
        { name: 'battery_checkin_time', type: 'string', isOptional: true }, // HH:mm format, default '09:00'

        // Metadata
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },

        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'practice_log',
      columns: [
        { name: 'practice_date', type: 'number', isIndexed: true }, // Timestamp truncated to day
        { name: 'practice_type', type: 'string' }, // 'log_weave' | 'add_reflection' | 'create_intention' | 'plan_weave' | 'view_reading'
        { name: 'related_id', type: 'string', isOptional: true }, // Reference to interaction/intention/etc
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'life_events',
      columns: [
        { name: 'friend_id', type: 'string', isIndexed: true },
        { name: 'event_type', type: 'string' }, // birthday, anniversary, new_job, moving, graduation, health_event, celebration, loss, wedding, baby, etc.
        { name: 'event_date', type: 'number' }, // When it happened/will happen
        { name: 'title', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'importance', type: 'string' }, // low, medium, high, critical
        { name: 'source', type: 'string' }, // manual, keyword_detected, recurring
        { name: 'is_recurring', type: 'boolean', defaultValue: false }, // For birthdays/anniversaries
        { name: 'reminded', type: 'boolean', defaultValue: false }, // Has user been notified
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'user_progress',
      columns: [
        // Path of Consistency
        { name: 'current_streak', type: 'number', defaultValue: 0 },
        { name: 'best_streak', type: 'number', defaultValue: 0 },
        { name: 'last_practice_date', type: 'number', isOptional: true },
        { name: 'consistency_milestones', type: 'string', isOptional: true }, // JSON array

        // v30: Streak forgiveness mechanics
        { name: 'last_streak_count', type: 'number', defaultValue: 0 }, // Streak count before it was broken
        { name: 'streak_released_date', type: 'number', isOptional: true }, // When the streak was released
        { name: 'longest_streak_ever', type: 'number', defaultValue: 0 }, // Never decreases

        // Path of Depth
        { name: 'total_reflections', type: 'number', defaultValue: 0 },
        { name: 'reflection_milestones', type: 'string', isOptional: true }, // JSON array

        // Path of Nurturing
        { name: 'friendship_milestones', type: 'string', isOptional: true }, // JSON array

        // New Achievements
        { name: 'catalyst_progress', type: 'number', defaultValue: 0 },
        { name: 'high_priestess_progress', type: 'number', defaultValue: 0 },
        { name: 'scribe_progress', type: 'number', defaultValue: 0 },
        { name: 'curator_progress', type: 'number', defaultValue: 0 },

        // Global Achievement System (v21)
        { name: 'total_weaves', type: 'number', defaultValue: 0 },
        { name: 'global_achievements', type: 'string', isOptional: true }, // JSON array
        { name: 'hidden_achievements', type: 'string', isOptional: true }, // JSON array

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },

        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'friend_badges',
      columns: [
        { name: 'friend_id', type: 'string', isIndexed: true },
        { name: 'badge_type', type: 'string', isIndexed: true }, // 'weave_count' | 'depth' | 'consistency' | 'special'
        { name: 'badge_id', type: 'string' }, // e.g., 'growing_bond', 'deep_roots'
        { name: 'tier', type: 'number' }, // 1-7 for progression tiers
        { name: 'unlocked_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'achievement_unlocks',
      columns: [
        { name: 'achievement_id', type: 'string', isIndexed: true },
        { name: 'achievement_type', type: 'string' }, // 'global' | 'friend_badge' | 'hidden'
        { name: 'related_friend_id', type: 'string', isOptional: true },
        { name: 'unlocked_at', type: 'number' },
        { name: 'has_been_celebrated', type: 'boolean', defaultValue: false },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'weekly_reflections',
      columns: [
        { name: 'week_start_date', type: 'number', isIndexed: true },
        { name: 'week_end_date', type: 'number', isIndexed: true },
        { name: 'total_weaves', type: 'number' },
        { name: 'friends_contacted', type: 'number' },
        { name: 'top_activity', type: 'string' },
        { name: 'top_activity_count', type: 'number' },
        { name: 'missed_friends_count', type: 'number' },
        { name: 'gratitude_text', type: 'string', isOptional: true },
        { name: 'gratitude_prompt', type: 'string', isOptional: true },
        { name: 'prompt_context', type: 'string', isOptional: true },
        { name: 'story_chips', type: 'string', isOptional: true }, // JSON: Array of story chip selections
        { name: 'completed_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'portfolio_snapshots',
      columns: [
        { name: 'snapshot_date', type: 'number', isIndexed: true }, // When this snapshot was taken
        { name: 'overall_health_score', type: 'number' }, // 0-100
        { name: 'total_friends', type: 'number' },
        { name: 'active_friends', type: 'number' }, // score > 30
        { name: 'drifting_friends', type: 'number' }, // score < 40
        { name: 'thriving_friends', type: 'number' }, // score > 80

        // Tier averages
        { name: 'inner_circle_avg', type: 'number' },
        { name: 'close_friends_avg', type: 'number' },
        { name: 'community_avg', type: 'number' },

        // Activity metrics (last 7 days from snapshot)
        { name: 'interactions_per_week', type: 'number' },
        { name: 'diversity_score', type: 'number' }, // 0-1

        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'journal_entries',
      columns: [
        { name: 'entry_date', type: 'number', isIndexed: true }, // Date this entry is associated with (can be backdated)
        { name: 'title', type: 'string', isOptional: true },
        { name: 'content', type: 'string' }, // Main journal text
        { name: 'story_chips', type: 'string', isOptional: true }, // JSON: Array of story chip selections
        { name: 'friend_ids', type: 'string', isOptional: true }, // JSON: Array of friend IDs tagged in this entry
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // NEW v31: Accounts and sync infrastructure
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'sync_status', type: 'string', isOptional: true },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'custom_chips',
      columns: [
        { name: 'chip_id', type: 'string', isIndexed: true }, // Unique chip ID (custom_timestamp_random)
        { name: 'chip_type', type: 'string' }, // activity, setting, people, dynamic, topic, feeling, moment, surprise
        { name: 'plain_text', type: 'string' }, // The chip text
        { name: 'template', type: 'string' }, // Template (same as plain_text for custom chips)
        { name: 'components', type: 'string', isOptional: true }, // JSON: Optional components for customization
        { name: 'usage_count', type: 'number', defaultValue: 0 }, // How many times used
        { name: 'last_used_at', type: 'number', isOptional: true }, // Last time this chip was used
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'chip_usage',
      columns: [
        { name: 'chip_id', type: 'string', isIndexed: true }, // Reference to chip (can be standard or custom)
        { name: 'interaction_id', type: 'string', isIndexed: true }, // Reference to interaction where used
        { name: 'friend_id', type: 'string', isIndexed: true, isOptional: true }, // Optional: which friend it was used for
        { name: 'chip_type', type: 'string' }, // For faster filtering
        { name: 'is_custom', type: 'boolean', defaultValue: false }, // Whether this is a custom chip
        { name: 'used_at', type: 'number' }, // Timestamp of usage
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'interaction_outcomes',
      columns: [
        { name: 'interaction_id', type: 'string', isIndexed: true },
        { name: 'friend_id', type: 'string', isIndexed: true },

        // Score context
        { name: 'score_before', type: 'number' },
        { name: 'score_after', type: 'number' }, // Measured at next interaction or 7 days later
        { name: 'score_change', type: 'number' }, // scoreAfter - scoreBefore

        // Interaction details
        { name: 'category', type: 'string' },
        { name: 'duration', type: 'string', isOptional: true },
        { name: 'vibe', type: 'string', isOptional: true },
        { name: 'had_reflection', type: 'boolean', defaultValue: false },

        // Effectiveness metrics
        { name: 'expected_impact', type: 'number' }, // What we predicted
        { name: 'actual_impact', type: 'number' }, // What happened (accounting for decay)
        { name: 'effectiveness_ratio', type: 'number' }, // actualImpact / expectedImpact

        // Timestamps
        { name: 'interaction_date', type: 'number' },
        { name: 'measured_at', type: 'number' }, // When we measured the outcome
        { name: 'created_at', type: 'number' },
      ]
    })
  ]
})