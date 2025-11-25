import { Database } from '@nozbe/watermelondb';
import { InteractionCategory, ActivityType } from '@/components/types';
import { migrateActivityToCategory } from '@/shared/constants/interaction-categories';

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
 * Ensure user_progress table has v30 streak forgiveness columns
 * This handles cases where schema migration didn't run properly
 */
export async function ensureUserProgressColumns(database: Database): Promise<void> {
  try {
    console.log('[Data Migration] Checking user_progress columns...');

    const progressCollection = database.get('user_progress');
    const progress = await progressCollection.query().fetch();

    if (progress.length === 0) {
      console.log('[Data Migration] No user_progress record found, skipping column check');
      return;
    }

    // We'll try to add columns regardless of whether we think they exist, 
    // catching errors for duplicates. This is more robust than checking _raw.
    const adapter = database.adapter;

    await database.write(async () => {
      // 1. last_streak_count
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['ALTER TABLE user_progress ADD COLUMN last_streak_count INTEGER DEFAULT 0', []],
          ],
        });
        console.log('[Data Migration] Added last_streak_count column');
      } catch (e) {
        // Ignore "duplicate column name" error
        console.log('[Data Migration] last_streak_count column likely exists or could not be added');
      }

      // 2. longest_streak_ever
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['ALTER TABLE user_progress ADD COLUMN longest_streak_ever INTEGER DEFAULT 0', []],
          ],
        });
        console.log('[Data Migration] Added longest_streak_ever column');
      } catch (e) {
        console.log('[Data Migration] longest_streak_ever column likely exists or could not be added');
      }

      // 3. streak_released_date
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['ALTER TABLE user_progress ADD COLUMN streak_released_date INTEGER', []],
          ],
        });
        console.log('[Data Migration] Added streak_released_date column');
      } catch (e) {
        console.log('[Data Migration] streak_released_date column likely exists or could not be added');
      }

      // Initialize longest_streak_ever to current best_streak if needed
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['UPDATE user_progress SET longest_streak_ever = best_streak WHERE longest_streak_ever = 0', []],
          ],
        });
      } catch (e) {
        console.log('[Data Migration] Failed to update longest_streak_ever values');
      }
    });

    console.log('[Data Migration] ✅ Column check complete');
  } catch (error) {
    console.error('[Data Migration] Error checking user_progress columns:', error);
  }
}

/**
 * Run data migration if needed
 * Safe to call multiple times - will only run once
 */
export async function runDataMigrationIfNeeded(database: Database): Promise<void> {
  // Run interaction category migration
  const isComplete = await isDataMigrationComplete(database);

  if (!isComplete) {
    console.log('[Data Migration] Migration needed, starting...');
    await migrateInteractionsToCategories(database);
  } else {
    console.log('[Data Migration] ✅ Data already migrated, skipping');
  }

  // Ensure user_progress has v30 columns
  await ensureUserProgressColumns(database);
}
