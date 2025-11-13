import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './db/schema';
import migrations from './db/migrations';
import Friend from './db/models/Friend';
import Interaction from './db/models/Interaction';
import InteractionFriend from './db/models/InteractionFriend';
import SuggestionEvent from './db/models/SuggestionEvent';
import Intention from './db/models/Intention';
import IntentionFriend from './db/models/IntentionFriend';
import UserProfile from './db/models/UserProfile';
import PracticeLog from './db/models/PracticeLog';
import LifeEvent from './db/models/LifeEvent';
import UserProgress from './db/models/UserProgress';
import FriendBadge from './db/models/FriendBadge';
import AchievementUnlock from './db/models/AchievementUnlock';
import WeeklyReflection from './db/models/WeeklyReflection';
import PortfolioSnapshot from './db/models/PortfolioSnapshot';
import JournalEntry from './db/models/JournalEntry';
import CustomChip from './db/models/CustomChip';
import ChipUsage from './db/models/ChipUsage';
import InteractionOutcome from './db/models/InteractionOutcome';

const adapter = new SQLiteAdapter({
  schema,
  migrations, // ENABLED: Schema migrations for interaction category system
  // dbName: 'weave',
  // jsi: true,
  onSetUpError: error => {
    // Database failed to load
    console.error('Database setup error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Friend,
    Interaction,
    InteractionFriend,
    SuggestionEvent,
    Intention,
    IntentionFriend,
    UserProfile,
    PracticeLog,
    LifeEvent,
    UserProgress,
    FriendBadge,
    AchievementUnlock,
    WeeklyReflection,
    PortfolioSnapshot,
    JournalEntry,
    CustomChip,
    ChipUsage,
    InteractionOutcome,
  ],
});

export const seedDatabase = async () => {
  const friendsCollection = database.get('friends');
  const count = await friendsCollection.query().fetchCount();

  if (count > 0) {
    return;
  }

  await database.write(async () => {
    await database.get('friends').create(friend => {
      friend.name = 'Alex Chen';
      friend.status = 'Green';
      friend.statusText = 'Coffee date last week';
      friend.archetype = 'Magician';
      friend.tier = 'InnerCircle';
    });
    await database.get('friends').create(friend => {
        friend.name = 'Sarah Martinez';
        friend.status = 'Yellow';
        friend.statusText = 'Text exchange two weeks ago';
        friend.archetype = 'Empress';
        friend.tier = 'CloseFriends';
    });
    await database.get('friends').create(friend => {
        friend.name = 'Jamie Thompson';
        friend.status = 'Red';
        friend.statusText = "Haven't connected in months";
        friend.archetype = 'Hermit';
        friend.tier = 'Community';
    });
  });
};

/**
 * Initialize user profile singleton
 * Should be called once on app startup
 */
export const initializeUserProfile = async () => {
  const profileCollection = database.get<UserProfile>('user_profile');
  const profiles = await profileCollection.query().fetch();

  if (profiles.length === 0) {
    await database.write(async () => {
      await profileCollection.create(profile => {
        profile.batteryCheckinEnabled = true;
        profile.batteryCheckinTime = '09:00';
      });
    });
  }
};

/**
 * Initialize user progress singleton
 * Should be called once on app startup
 */
export const initializeUserProgress = async () => {
  const progressCollection = database.get<UserProgress>('user_progress');
  const progress = await progressCollection.query().fetch();

  if (progress.length === 0) {
    await database.write(async () => {
      await progressCollection.create(p => {
        p.currentStreak = 0;
        p.bestStreak = 0;
        p.totalReflections = 0;
        p.consistencyMilestones = [];
        p.reflectionMilestones = [];
        p.friendshipMilestones = [];
        // Global achievement system (v21)
        p.totalWeaves = 0;
        p.globalAchievements = [];
        p.hiddenAchievements = [];
      });
    });
  }
};

/**
 * DANGER: Completely wipes all app data
 * - Deletes all WatermelonDB records
 * - Clears all AsyncStorage keys
 * - Resets to factory state
 */
export const clearDatabase = async () => {
  try {
    console.log('[clearDatabase] Starting complete data wipe...');

    // 1. Clear all WatermelonDB collections
    await database.write(async () => {
      const collections = [
        'friends',
        'interactions',
        'interaction_friends',
        'suggestion_events',
        'intentions',
        'intention_friends',
        'user_profile',
        'practice_logs',
        'life_events',
        'user_progress',
        'friend_badges',
        'achievement_unlocks',
        'weekly_reflections',
        'portfolio_snapshots',
        'journal_entries',
        'custom_chips',
        'chip_usage',
        'interaction_outcomes',
      ];

      for (const collectionName of collections) {
        try {
          const collection = database.get(collectionName);
          const allRecords = await collection.query().fetch();
          console.log(`[clearDatabase] Deleting ${allRecords.length} records from ${collectionName}`);

          // Mark all records for deletion
          await Promise.all(
            allRecords.map(record => record.markAsDeleted())
          );
        } catch (error) {
          console.error(`[clearDatabase] Error clearing collection ${collectionName}:`, error);
        }
      }
    });

    // 2. Clear all AsyncStorage keys
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const storageKeys = [
      '@weave_tutorial_state',
      '@weave:smart_defaults_enabled',
      '@weave:last_smart_notification',
      '@weave:smart_notification_count',
      '@weave:notification_preferences',
      '@weave_calendar_settings',
      '@weave:last_reflection_date',
      '@weave:last_memory_check',
      '@weave:event_reminders_enabled',
      '@weave:deepening_nudges_enabled',
      '@weave:smart_notifications_enabled',
      '@weave:last_battery_nudge',
      '@weave:deepening_nudges',
      '@weave:notifications_initialized',
    ];

    console.log(`[clearDatabase] Clearing ${storageKeys.length} AsyncStorage keys`);
    await AsyncStorage.multiRemove(storageKeys);

    // 3. Reinitialize default data
    console.log('[clearDatabase] Reinitializing default data...');
    await initializeUserProfile();
    await initializeUserProgress();

    console.log('[clearDatabase] ✅ Complete data wipe finished successfully');
    return { success: true };
  } catch (error) {
    console.error('[clearDatabase] ❌ Error during data wipe:', error);
    throw error;
  }
};

/**
 * Initialize data migrations
 * Should be called once on app startup after database is ready
 */
export const initializeDataMigrations = async () => {
  const { runDataMigrationIfNeeded } = await import('./db/data-migration');
  await runDataMigrationIfNeeded(database);
};