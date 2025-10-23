import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for WatermelonDB
 *
 * Migration from v8 to v9:
 * - Add interaction_category field to interactions table
 * - This enables the new simplified 8-category interaction system
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
  ],
});
