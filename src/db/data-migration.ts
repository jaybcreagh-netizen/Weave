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

    const userProgress = progress[0];

    // Check if the record has the v30 fields
    const hasV30Fields =
      'last_streak_count' in userProgress._raw &&
      'longest_streak_ever' in userProgress._raw;

    if (!hasV30Fields) {
      console.log('[Data Migration] Missing v30 streak fields, adding columns via SQL...');

      // Add columns directly via SQL ALTER TABLE
      // This is a workaround for cases where schema migrations didn't run
      try {
        const adapter = database.adapter;

        await database.write(async () => {
          // Add last_streak_count column if missing
          if (!('last_streak_count' in userProgress._raw)) {
            await adapter.unsafeExecute({
              sqls: [
                ['ALTER TABLE user_progress ADD COLUMN last_streak_count INTEGER DEFAULT 0', []],
              ],
            });
            console.log('[Data Migration] Added last_streak_count column');
          }

          // Add longest_streak_ever column if missing
          if (!('longest_streak_ever' in userProgress._raw)) {
            await adapter.unsafeExecute({
              sqls: [
                ['ALTER TABLE user_progress ADD COLUMN longest_streak_ever INTEGER DEFAULT 0', []],
              ],
            });
            console.log('[Data Migration] Added longest_streak_ever column');
          }

          // Add streak_released_date column if missing
          if (!('streak_released_date' in userProgress._raw)) {
            await adapter.unsafeExecute({
              sqls: [
                ['ALTER TABLE user_progress ADD COLUMN streak_released_date INTEGER', []],
              ],
            });
            console.log('[Data Migration] Added streak_released_date column');
          }

          // Initialize longest_streak_ever to current best_streak if needed
          await adapter.unsafeExecute({
            sqls: [
              ['UPDATE user_progress SET longest_streak_ever = best_streak WHERE longest_streak_ever = 0', []],
            ],
          });
        });

        console.log('[Data Migration] ✅ Successfully added v30 streak columns');
      } catch (error) {
        console.error('[Data Migration] ⚠️ Could not add columns via SQL:', error);
        console.log('[Data Migration] User may need to reinstall app for fresh database');
      }
    } else {
      console.log('[Data Migration] ✅ user_progress has v30 fields');
    }
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
