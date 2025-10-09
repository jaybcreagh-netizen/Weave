import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'friends',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'status_text', type: 'string' },
        { name: 'archetype', type: 'string' },
        { name: 'tier', type: 'string' },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'interactions',
      columns: [
        { name: 'friend_ids', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'activity', type: 'string' },
        { name: 'mode', type: 'string', isOptional: true },
        { name: 'date', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'moon_phase', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'location', type: 'string', isOptional: true },
        { name: 'tags', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
  ]
})