import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 15, // UPDATED: Added birthday, anniversary, relationship_type to friends; added life_events table
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
        { name: 'birthday', type: 'number', isOptional: true }, // Timestamp (month/day, year optional)
        { name: 'anniversary', type: 'number', isOptional: true }, // When you met/became friends
        { name: 'relationship_type', type: 'string', isOptional: true }, // friend, close_friend, family, partner, colleague, acquaintance
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
        { name: 'status', type: 'string' },
        { name: 'mode', type: 'string' },
        // NEW: Simplified interaction category system
        { name: 'interaction_category', type: 'string', isOptional: true },
        // NEW: Structured reflection data (JSON string)
        { name: 'reflection', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
        name: 'interaction_friends',
        columns: [
            { name: 'interaction_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
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
        { name: 'friend_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'interaction_category', type: 'string', isOptional: true },
        { name: 'status', type: 'string' }, // active, converted, dismissed
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'last_reminded_at', type: 'number', isOptional: true },
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
      ]
    })
  ]
})