import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 9, // UPDATED: Added interaction_category field
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
        { name: 'activity', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mode', type: 'string' },
        // NEW: Simplified interaction category system
        { name: 'interaction_category', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
        name: 'interaction_friends',
        columns: [
            { name: 'interaction_id', type: 'string', isIndexed: true },
            { name: 'friend_id', type: 'string', isIndexed: true },
        ]
    })
  ]
})