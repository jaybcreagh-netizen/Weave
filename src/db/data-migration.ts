import { Database, Q } from '@nozbe/watermelondb';
import { InteractionCategory, ActivityType } from '@/components/types';
import { logger } from '@/shared/services/logger.service';
// import { migrateActivityToCategory } from '@/shared/constants/interaction-categories';


// Helper to migrate old activity types to new categories
function migrateActivityToCategory(activity: string): InteractionCategory {
  const map: Record<string, InteractionCategory> = {
    'catch_up': 'text-call',
    'deep_talk': 'deep-talk',
    'hangout': 'hangout',
    'party': 'event-party',
    'activity': 'activity-hobby',
    'travel': 'activity-hobby',
    'work': 'activity-hobby',
    'other': 'text-call',
  };
  return map[activity] || 'text-call';
}

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
  const CHUNK_SIZE = 100;

  try {
    let migratedCount = 0;
    let errorCount = 0;
    let offset = 0;
    let hasMore = true;

    logger.info('DataMigration', 'Starting chunked interaction category migration...');

    while (hasMore) {
      // Fetch chunk of interactions
      const chunk = await interactionsCollection
        .query(
          Q.take(CHUNK_SIZE),
          Q.skip(offset)
        )
        .fetch();

      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      // Process chunk in single batch operation
      await database.write(async () => {
        const batchOps: any[] = [];

        for (const interaction of chunk) {
          try {
            // Skip if already has a category
            if ((interaction._raw as any).interaction_category) {
              continue;
            }

            // Get the old activity field
            const oldActivity = (interaction._raw as any).activity as ActivityType;

            if (!oldActivity) {
              logger.warn('DataMigration', `Interaction ${interaction.id} has no activity field, skipping`);
              continue;
            }

            // Migrate to new category
            const newCategory = migrateActivityToCategory(oldActivity);

            // Prepare update operation
            const preparedUpdate = interaction.prepareUpdate((record: any) => {
              (record._raw as any).interaction_category = newCategory;
            });

            batchOps.push(preparedUpdate);
          } catch (error) {
            logger.error('DataMigration', `Failed when processing interaction ${interaction.id}:`, error);
            errorCount++;
          }
        }

        // Execute all updates in a single batch
        if (batchOps.length > 0) {
          await database.batch(...batchOps);
          migratedCount += batchOps.length;
        }
      });

      logger.info('DataMigration', `Processed ${offset + chunk.length} interactions (migrated: ${migratedCount}, errors: ${errorCount})...`);
      offset += chunk.length;
    }

    logger.info('DataMigration', `✅ Migration complete. Migrated ${migratedCount} interactions with ${errorCount} errors.`);
  } catch (error) {
    logger.error('DataMigration', '❌ Fatal error during migration:', error);
    throw error;
  }
}

/**
 * Check if data migration has been completed
 * Returns true if all interactions have a category field
 * Uses chunking to avoid loading all interactions into memory
 */
export async function isDataMigrationComplete(database: Database): Promise<boolean> {
  try {
    const interactionsCollection = database.get('interactions');
    const CHUNK_SIZE = 100;
    let offset = 0;
    let hasMore = true;
    let totalUnmigrated = 0;

    while (hasMore) {
      const chunk = await interactionsCollection
        .query(
          Q.take(CHUNK_SIZE),
          Q.skip(offset)
        )
        .fetch();

      if (chunk.length === 0) {
        // No more interactions
        hasMore = false;
        break;
      }

      // Check chunk for unmigrated interactions
      const unmigratedInChunk = chunk.filter(
        (interaction) => !(interaction._raw as any).interaction_category
      );

      totalUnmigrated += unmigratedInChunk.length;

      // Early return if we find any unmigrated interactions
      if (totalUnmigrated > 0) {
        logger.info(
          'DataMigration',
          `Found ${totalUnmigrated} unmigrated interactions (checked ${offset + chunk.length} so far)`
        );
        return false;
      }

      offset += chunk.length;
    }

    if (offset === 0) {
      // No interactions yet, migration not needed
      return true;
    }

    return totalUnmigrated === 0;
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


    const progressCollection = database.get('user_progress');
    const progress = await progressCollection.query().fetch();

    if (progress.length === 0) {
      // No progress record yet, so we can't check columns easily.
      // But typically user_progress is created immediately.
      // If it's effectively empty, we might not need to migrate yet or it's a fresh install where schema is correct.
      return;
    }

    // Check if columns already exist by inspecting the first record
    const firstRecord = progress[0];
    // @ts-ignore - _raw is internal but accessible
    if ('last_streak_count' in firstRecord._raw) {
      // Columns already exist, skip migration to avoid "duplicate column" errors
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
      } catch (e) {
        // Ignore "duplicate column name" error
      }

      // 2. longest_streak_ever
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['ALTER TABLE user_progress ADD COLUMN longest_streak_ever INTEGER DEFAULT 0', []],
          ],
        });
      } catch (e) {
      }

      // 3. streak_released_date
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['ALTER TABLE user_progress ADD COLUMN streak_released_date INTEGER', []],
          ],
        });
      } catch (e) {
      }

      // Initialize longest_streak_ever to current best_streak if needed
      try {
        await adapter.unsafeExecute({
          sqls: [
            ['UPDATE user_progress SET longest_streak_ever = best_streak WHERE longest_streak_ever = 0', []],
          ],
        });
      } catch (e) {

      }
    });


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

    await migrateInteractionsToCategories(database);
  } else {

  }

  // Ensure user_progress has v30 columns
  await ensureUserProgressColumns(database);
}
