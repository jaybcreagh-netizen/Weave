import { Database } from '@nozbe/watermelondb';
import { InteractionCategory, ActivityType } from '../components/types';
import { migrateActivityToCategory } from '../lib/interaction-categories';

/**
 * Migrate existing interactions to use the new category system
 *
 * This function:
 * 1. Queries all interactions without a category
 * 2. Maps their old activity → new category
 * 3. Updates the interaction_category field
 *
 * Called once after schema migration from v8 to v9
 */
export async function migrateInteractionsToCategories(database: Database): Promise<void> {
  const interactionsCollection = database.get('interactions');

  try {
    console.log('[Data Migration] Starting interaction category migration...');

    // Get all interactions
    const allInteractions = await interactionsCollection.query().fetch();

    console.log(`[Data Migration] Found ${allInteractions.length} interactions to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    // Batch update all interactions
    await database.write(async () => {
      for (const interaction of allInteractions) {
        try {
          // Skip if already has a category
          if (interaction._raw.interaction_category) {
            continue;
          }

          // Get the old activity field
          const oldActivity = interaction._raw.activity as ActivityType;

          if (!oldActivity) {
            console.warn(`[Data Migration] Interaction ${interaction.id} has no activity field, skipping`);
            continue;
          }

          // Migrate to new category
          const newCategory = migrateActivityToCategory(oldActivity);

          // Update the interaction
          await interaction.update((record: any) => {
            record._raw.interaction_category = newCategory;
          });

          migratedCount++;

          // Log progress every 10 interactions
          if (migratedCount % 10 === 0) {
            console.log(`[Data Migration] Migrated ${migratedCount} interactions...`);
          }
        } catch (error) {
          console.error(`[Data Migration] Error migrating interaction ${interaction.id}:`, error);
          errorCount++;
        }
      }
    });

    console.log(`[Data Migration] ✅ Migration complete!`);
    console.log(`[Data Migration] Migrated: ${migratedCount} interactions`);
    console.log(`[Data Migration] Errors: ${errorCount}`);
    console.log(`[Data Migration] Already migrated: ${allInteractions.length - migratedCount - errorCount}`);
  } catch (error) {
    console.error('[Data Migration] ❌ Fatal error during migration:', error);
    throw error;
  }
}

/**
 * Check if data migration has been completed
 * Returns true if all interactions have a category field
 */
export async function isDataMigrationComplete(database: Database): Promise<boolean> {
  try {
    const interactionsCollection = database.get('interactions');
    const allInteractions = await interactionsCollection.query().fetch();

    if (allInteractions.length === 0) {
      // No interactions yet, migration not needed
      return true;
    }

    // Check if all interactions have a category
    const unmigrated = allInteractions.filter(
      (interaction) => !interaction._raw.interaction_category
    );

    const isComplete = unmigrated.length === 0;

    if (!isComplete) {
      console.log(
        `[Data Migration] ${unmigrated.length} interactions still need migration`
      );
    }

    return isComplete;
  } catch (error) {
    console.error('[Data Migration] Error checking migration status:', error);
    return false;
  }
}

/**
 * Run data migration if needed
 * Safe to call multiple times - will only run once
 */
export async function runDataMigrationIfNeeded(database: Database): Promise<void> {
  const isComplete = await isDataMigrationComplete(database);

  if (!isComplete) {
    console.log('[Data Migration] Migration needed, starting...');
    await migrateInteractionsToCategories(database);
  } else {
    console.log('[Data Migration] ✅ Data already migrated, skipping');
  }
}
