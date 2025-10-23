import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

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
  ],
});
