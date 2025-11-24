import { schemaMigrations, addColumns, createTable, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for WatermelonDB
 *
 * Migration from v8 to v9:
 * - Add interaction_category field to interactions table
 * - This enables the new simplified 8-category interaction system
 *
 * Migration from v9 to v10:
 * - Add reflection field to interactions table
 * - Stores structured reflection data (chips + custom notes) as JSON
 *
 * Migration from v10 to v11:
 * - Add suggestion_events table for tracking suggestion actions
 * - Enables learning and optimization of the suggestion engine
 *
 * Migration from v11 to v12:
 * - Add updated_at field to interactions table
 * - Enables reactive timeline updates when reflections are edited
 *
 * Migration from v12 to v13:
 * - Add intentions table for connection planning
 * - Enables setting connection intentions before scheduling concrete plans
 *
 * Migration from v13 to v14:
 * - Add user_profile table for social season and battery tracking
 * - Add practice_log table for streak system (Phase 3)
 * - Enables home dashboard personalization
 *
 * Migration from v14 to v15:
 * - Add birthday, anniversary, relationship_type to friends table
 * - Add life_events table for tracking important life events
 * - Enables life event tracking and context-aware suggestions
 *
 * Migration from v15 to v16:
 * - Add user_progress table for milestone tracking
 * - Tracks Path of Consistency (practice streak), Path of Depth (reflections), Path of Nurturing (friend milestones)
 * - Enables "Weaving Journey" gamification system
 *
 * Migration from v16 to v17:
 * - Add title, location, completion_prompted_at to interactions table
 * - Enables custom weave titles, location tracking (Phase 1), and plan lifecycle management
 * - Supports new Log vs Plan redesign with plan confirmation flow
 *
 * Migration from v17 to v18:
 * - Add calendar_event_id to interactions table
 * - Enables calendar integration for planned weaves
 */
export default schemaMigrations({
  migrations: [
    {
      // Migration from schema v8 to v9
      toVersion: 9,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'interaction_category', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 34,
      steps: [
        createTable({
          name: 'oracle_insights',
          columns: [
            { name: 'insight_type', type: 'string' },
            { name: 'content', type: 'string' },
            { name: 'metadata', type: 'string' },
            { name: 'valid_until', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'oracle_usage',
          columns: [
            { name: 'endpoint', type: 'string' },
            { name: 'tokens_used', type: 'number' },
            { name: 'cost_cents', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v9 to v10
      toVersion: 10,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'reflection', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v10 to v11
      toVersion: 11,
      steps: [
        createTable({
          name: 'suggestion_events',
          columns: [
            { name: 'suggestion_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
            { name: 'suggestion_type', type: 'string' },
            { name: 'urgency', type: 'string' },
            { name: 'action_type', type: 'string' },
            { name: 'event_type', type: 'string' },
            { name: 'event_timestamp', type: 'number' },
            { name: 'friend_score_at_event', type: 'number', isOptional: true },
            { name: 'days_since_last_interaction', type: 'number', isOptional: true },
            { name: 'resulting_interaction_id', type: 'string', isOptional: true },
            { name: 'time_to_action_minutes', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v11 to v12
      toVersion: 12,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v12 to v13
      toVersion: 13,
      steps: [
        createTable({
          name: 'intentions',
          columns: [
            { name: 'friend_id', type: 'string', isIndexed: true },
            { name: 'description', type: 'string', isOptional: true },
            { name: 'interaction_category', type: 'string', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'last_reminded_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v13 to v14
      toVersion: 14,
      steps: [
        createTable({
          name: 'user_profile',
          columns: [
            { name: 'current_social_season', type: 'string', isOptional: true },
            { name: 'season_last_calculated', type: 'number', isOptional: true },
            { name: 'season_history', type: 'string', isOptional: true },
            { name: 'social_battery_current', type: 'number', isOptional: true },
            { name: 'social_battery_last_checkin', type: 'number', isOptional: true },
            { name: 'social_battery_history', type: 'string', isOptional: true },
            { name: 'battery_checkin_enabled', type: 'boolean', isOptional: true },
            { name: 'battery_checkin_time', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'practice_log',
          columns: [
            { name: 'practice_date', type: 'number', isIndexed: true },
            { name: 'practice_type', type: 'string' },
            { name: 'related_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v14 to v15
      toVersion: 15,
      steps: [
        addColumns({
          table: 'friends',
          columns: [
            { name: 'birthday', type: 'number', isOptional: true },
            { name: 'anniversary', type: 'number', isOptional: true },
            { name: 'relationship_type', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: 'life_events',
          columns: [
            { name: 'friend_id', type: 'string', isIndexed: true },
            { name: 'event_type', type: 'string' },
            { name: 'event_date', type: 'number' },
            { name: 'title', type: 'string' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'importance', type: 'string' },
            { name: 'source', type: 'string' },
            { name: 'is_recurring', type: 'boolean' },
            { name: 'reminded', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v15 to v16
      toVersion: 16,
      steps: [
        createTable({
          name: 'user_progress',
          columns: [
            { name: 'current_streak', type: 'number' },
            { name: 'best_streak', type: 'number' },
            { name: 'last_practice_date', type: 'number', isOptional: true },
            { name: 'consistency_milestones', type: 'string', isOptional: true },
            { name: 'total_reflections', type: 'number' },
            { name: 'reflection_milestones', type: 'string', isOptional: true },
            { name: 'friendship_milestones', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v16 to v17
      toVersion: 17,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'title', type: 'string', isOptional: true },
            { name: 'location', type: 'string', isOptional: true },
            { name: 'completion_prompted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v17 to v18
      toVersion: 18,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'calendar_event_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v18 to v19
      toVersion: 19,
      steps: [
        // Create intention_friends join table
        createTable({
          name: 'intention_friends',
          columns: [
            { name: 'intention_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v19 to v20
      toVersion: 20,
      steps: [
        addColumns({
          table: 'user_progress',
          columns: [
            { name: 'catalyst_progress', type: 'number', isOptional: true },
            { name: 'high_priestess_progress', type: 'number', isOptional: true },
            { name: 'scribe_progress', type: 'number', isOptional: true },
            { name: 'curator_progress', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v20 to v21
      // Achievement System Redesign: Friend Badges + Global Achievements
      toVersion: 21,
      steps: [
        // Add global achievement tracking to user_progress
        addColumns({
          table: 'user_progress',
          columns: [
            { name: 'total_weaves', type: 'number', isOptional: true },
            { name: 'global_achievements', type: 'string', isOptional: true }, // JSON array
            { name: 'hidden_achievements', type: 'string', isOptional: true }, // JSON array
          ],
        }),
        // Create friend_badges table for per-friend achievement milestones
        createTable({
          name: 'friend_badges',
          columns: [
            { name: 'friend_id', type: 'string', isIndexed: true },
            { name: 'badge_type', type: 'string', isIndexed: true },
            { name: 'badge_id', type: 'string' },
            { name: 'tier', type: 'number' },
            { name: 'unlocked_at', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        // Create achievement_unlocks table for tracking unlock history
        createTable({
          name: 'achievement_unlocks',
          columns: [
            { name: 'achievement_id', type: 'string', isIndexed: true },
            { name: 'achievement_type', type: 'string' },
            { name: 'related_friend_id', type: 'string', isOptional: true },
            { name: 'unlocked_at', type: 'number' },
            { name: 'has_been_celebrated', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v21 to v22
      // Weekly Reflection System
      toVersion: 22,
      steps: [
        createTable({
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
            { name: 'completed_at', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v22 to v23
      // Adaptive Decay Pattern Learning + Portfolio Snapshots
      toVersion: 23,
      steps: [
        // Add adaptive decay learning fields to friends
        addColumns({
          table: 'friends',
          columns: [
            { name: 'typical_interval_days', type: 'number', isOptional: true },
            { name: 'tolerance_window_days', type: 'number', isOptional: true },
          ],
        }),
        // Create portfolio_snapshots table for trend tracking
        createTable({
          name: 'portfolio_snapshots',
          columns: [
            { name: 'snapshot_date', type: 'number', isIndexed: true },
            { name: 'overall_health_score', type: 'number' },
            { name: 'total_friends', type: 'number' },
            { name: 'active_friends', type: 'number' },
            { name: 'drifting_friends', type: 'number' },
            { name: 'thriving_friends', type: 'number' },
            { name: 'inner_circle_avg', type: 'number' },
            { name: 'close_friends_avg', type: 'number' },
            { name: 'community_avg', type: 'number' },
            { name: 'interactions_per_week', type: 'number' },
            { name: 'diversity_score', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v23 to v24
      // Weekly Reflection Story Chips
      toVersion: 24,
      steps: [
        addColumns({
          table: 'weekly_reflections',
          columns: [
            { name: 'story_chips', type: 'string', isOptional: true }, // JSON array
          ],
        }),
      ],
    },
    {
      // Migration from schema v24 to v25
      // Journal Entries - Ad-hoc journaling separate from weekly reflections
      toVersion: 25,
      steps: [
        createTable({
          name: 'journal_entries',
          columns: [
            { name: 'entry_date', type: 'number', isIndexed: true },
            { name: 'title', type: 'string', isOptional: true },
            { name: 'content', type: 'string' },
            { name: 'story_chips', type: 'string', isOptional: true },
            { name: 'friend_ids', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v25 to v26
      // Enhanced Story Chips System - Custom chips and usage tracking for adaptive suggestions
      toVersion: 26,
      steps: [
        createTable({
          name: 'custom_chips',
          columns: [
            { name: 'chip_id', type: 'string', isIndexed: true },
            { name: 'chip_type', type: 'string' },
            { name: 'plain_text', type: 'string' },
            { name: 'template', type: 'string' },
            { name: 'components', type: 'string', isOptional: true },
            { name: 'usage_count', type: 'number' },
            { name: 'last_used_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'chip_usage',
          columns: [
            { name: 'chip_id', type: 'string', isIndexed: true },
            { name: 'interaction_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'chip_type', type: 'string' },
            { name: 'is_custom', type: 'boolean' },
            { name: 'used_at', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v26 to v27
      // Interaction outcomes feedback system + reciprocity tracking
      toVersion: 27,
      steps: [
        // Add effectiveness tracking to friends
        addColumns({
          table: 'friends',
          columns: [
            { name: 'category_effectiveness', type: 'string', isOptional: true },
            { name: 'outcome_count', type: 'number', isOptional: true },
            { name: 'initiation_ratio', type: 'number', isOptional: true },
            { name: 'last_initiated_by', type: 'string', isOptional: true },
            { name: 'consecutive_user_initiations', type: 'number', isOptional: true },
            { name: 'total_user_initiations', type: 'number', isOptional: true },
            { name: 'total_friend_initiations', type: 'number', isOptional: true },
          ],
        }),
        // Add event importance and initiator to interactions
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'event_importance', type: 'string', isOptional: true },
            { name: 'initiator', type: 'string', isOptional: true },
          ],
        }),
        // Create interaction_outcomes table for adaptive learning
        createTable({
          name: 'interaction_outcomes',
          columns: [
            { name: 'interaction_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
            { name: 'score_before', type: 'number' },
            { name: 'score_after', type: 'number' },
            { name: 'score_change', type: 'number' },
            { name: 'category', type: 'string' },
            { name: 'duration', type: 'string', isOptional: true },
            { name: 'vibe', type: 'string', isOptional: true },
            { name: 'had_reflection', type: 'boolean' },
            { name: 'expected_impact', type: 'number' },
            { name: 'actual_impact', type: 'number' },
            { name: 'effectiveness_ratio', type: 'number' },
            { name: 'interaction_date', type: 'number' },
            { name: 'measured_at', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v27 to v28
      // Changed birthday from timestamp (number) to MM-DD string format (no year)
      toVersion: 28,
      steps: [
        // Since WatermelonDB doesn't support direct column type changes,
        // and birthday is optional, we'll clear existing values
        // Users will need to re-enter birthdays in the new format
        // Future enhancement: Could convert timestamps to MM-DD format with custom SQL
        unsafeExecuteSql(`UPDATE friends SET birthday = NULL WHERE birthday IS NOT NULL;`),
      ],
    },
    {
      // Migration from schema v28 to v29
      // Intention fulfillment tracking for pattern analysis and celebration
      toVersion: 29,
      steps: [
        addColumns({
          table: 'intentions',
          columns: [
            { name: 'linked_interaction_id', type: 'string', isOptional: true },
            { name: 'fulfilled_at', type: 'number', isOptional: true },
            { name: 'days_to_fulfillment', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v29 to v30
      // Changed anniversary from timestamp (number) to MM-DD string format (no year)
      toVersion: 30,
      steps: [
        // Since WatermelonDB doesn't support direct column type changes,
        // and anniversary is optional, we'll clear existing values
        // Users will need to re-enter anniversaries in the new format
        unsafeExecuteSql(`UPDATE friends SET anniversary = NULL WHERE anniversary IS NOT NULL;`),
        // Add streak forgiveness mechanics
        addColumns({
          table: 'user_progress',
          columns: [
            { name: 'last_streak_count', type: 'number', isOptional: true },
            { name: 'streak_released_date', type: 'number', isOptional: true },
            { name: 'longest_streak_ever', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v30 to v31
      // Accounts System Infrastructure - Add user_id and sync columns to all tables
      // Enables cloud sync, multi-device support, and freemium model
      toVersion: 31,
      steps: [
        // Add account columns to friends table
        addColumns({
          table: 'friends',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to interactions table
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to interaction_friends table
        addColumns({
          table: 'interaction_friends',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
          ],
        }),
        // Add account columns to intentions table
        addColumns({
          table: 'intentions',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to intention_friends table
        addColumns({
          table: 'intention_friends',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
          ],
        }),
        // Add account columns to user_profile table (will become per-user)
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to user_progress table
        addColumns({
          table: 'user_progress',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to life_events table
        addColumns({
          table: 'life_events',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to weekly_reflections table
        addColumns({
          table: 'weekly_reflections',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Add account columns to journal_entries table
        addColumns({
          table: 'journal_entries',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        // Note: Some tables like suggestion_events, practice_log, friend_badges,
        // achievement_unlocks, portfolio_snapshots, custom_chips, chip_usage,
        // and interaction_outcomes may be local-only or synced later
        // For now, adding sync columns to core relationship data only
      ],
    },
    {
      // Migration from schema v31 to v32
      // Weekly Reflection Preferences - User control over reflection prompts
      toVersion: 32,
      steps: [
        addColumns({
          table: 'user_profile',
          columns: [
            { name: 'reflection_day', type: 'number', isOptional: true }, // 0-6 (0=Sunday)
            { name: 'reflection_auto_show', type: 'boolean', isOptional: true }, // Auto-show prompt
            { name: 'reflection_last_snoozed', type: 'number', isOptional: true }, // Snooze timestamp
          ],
        }),
      ],
    },
    {
      // Migration from schema v32 to v33
      // Event Suggestion Feedback - Learning system for ambient logging
      toVersion: 33,
      steps: [
        createTable({
          name: 'event_suggestion_feedback',
          columns: [
            { name: 'calendar_event_id', type: 'string', isIndexed: true },
            { name: 'event_title', type: 'string' },
            { name: 'event_date', type: 'number' },
            { name: 'event_location', type: 'string', isOptional: true },
            { name: 'suggested_friend_ids', type: 'string' },
            { name: 'suggested_category', type: 'string', isOptional: true },
            { name: 'action', type: 'string' },
            { name: 'dismissal_reason', type: 'string', isOptional: true },
            { name: 'corrected_friend_ids', type: 'string', isOptional: true },
            { name: 'corrected_category', type: 'string', isOptional: true },
            { name: 'snoozed_until', type: 'number', isOptional: true },
            { name: 'snooze_type', type: 'string', isOptional: true },
            { name: 'snoozed_friend_ids', type: 'string', isOptional: true },
            { name: 'emotional_rating', type: 'number', isOptional: true },
            { name: 'reflection_notes', type: 'string', isOptional: true },
            { name: 'resulting_interaction_id', type: 'string', isOptional: true },
            { name: 'confidence_score', type: 'number' },
            { name: 'match_quality', type: 'number' },
            { name: 'suggested_at', type: 'number' },
            { name: 'responded_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Migration from schema v33 to v34 (skipped in original file structure but adding logic for clarity)
      // The schema file says v34, so we assume v34 migration logic was already applied or implicit.
      // However, we see a block with toVersion: 34 earlier in the file.
      // We will just add v35 here.

      // Migration from schema v34 to v35
      // Refactor history logs and indexing optimization
      toVersion: 35,
      steps: [
        createTable({
          name: 'social_season_logs',
          columns: [
            { name: 'user_id', type: 'string' },
            { name: 'season', type: 'string' },
            { name: 'start_date', type: 'number' },
            { name: 'end_date', type: 'number' },
          ],
        }),
        createTable({
          name: 'social_battery_logs',
          columns: [
            { name: 'user_id', type: 'string' },
            { name: 'value', type: 'number' },
            { name: 'timestamp', type: 'number' },
          ],
        }),
        createTable({
          name: 'journal_entry_friends',
          columns: [
            { name: 'journal_entry_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
          ],
        }),
        // Add indexes to interactions table manually since addColumns isn't needed
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS index_interactions_status ON interactions (status);`
        ),
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS index_interactions_interaction_date ON interactions (interaction_date);`
        ),
      ],
    },
  ],
});

