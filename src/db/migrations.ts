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
  ],
});
