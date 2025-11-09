import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

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
 *
 * Migration from v18 to v19:
 * - Add intention_friends join table
 * - Enables many-to-many relationship between intentions and friends
 *
 * Migration from v19 to v20:
 * - Add achievement progress fields to user_progress table
 * - Enables new achievement tracking system
 *
 * Migration from v20 to v21:
 * - Add typical_interval_days, tolerance_window_days to friends table
 * - Enables adaptive decay based on learned interaction patterns
 *
 * Migration from v21 to v22:
 * - Add portfolio_snapshots table
 * - Enables historical trend tracking of network health
 *
 * Migration from v22 to v23:
 * - Add category_effectiveness, outcome_count to friends table
 * - Add interaction_outcomes table for feedback learning
 * - Enables interaction success feedback loop and adaptive scoring
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
            { name: 'catalyst_progress', type: 'number', defaultValue: 0 },
            { name: 'high_priestess_progress', type: 'number', defaultValue: 0 },
            { name: 'scribe_progress', type: 'number', defaultValue: 0 },
            { name: 'curator_progress', type: 'number', defaultValue: 0 },
          ],
        }),
      ],
    },
    {
      // Migration from schema v20 to v21
      toVersion: 21,
      steps: [
        addColumns({
          table: 'friends',
          columns: [
            { name: 'typical_interval_days', type: 'number', isOptional: true },
            { name: 'tolerance_window_days', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migration from schema v21 to v22
      toVersion: 22,
      steps: [
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
      // Migration from schema v22 to v23
      toVersion: 23,
      steps: [
        addColumns({
          table: 'friends',
          columns: [
            { name: 'category_effectiveness', type: 'string', isOptional: true },
            { name: 'outcome_count', type: 'number', defaultValue: 0 },
          ],
        }),
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
            { name: 'had_reflection', type: 'boolean', defaultValue: false },
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
  ],
});

