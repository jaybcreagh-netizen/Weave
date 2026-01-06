import 'react-native-get-random-values';
import { Database } from '@nozbe/watermelondb';
import { logger } from '@/shared/services/logger.service';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import Friend from './models/Friend';
import Interaction from './models/Interaction';
import InteractionFriend from './models/InteractionFriend';
import SuggestionEvent from './models/SuggestionEvent';
import Intention from './models/Intention';
import IntentionFriend from './models/IntentionFriend';
import UserProfile from './models/UserProfile';
import PracticeLog from './models/PracticeLog';
import LifeEvent from './models/LifeEvent';
import UserProgress from './models/UserProgress';
import FriendBadge from './models/FriendBadge';
import AchievementUnlock from './models/AchievementUnlock';
import WeeklyReflection from './models/WeeklyReflection';
import PortfolioSnapshot from './models/PortfolioSnapshot';
import JournalEntry from './models/JournalEntry';
import CustomChip from './models/CustomChip';
import ChipUsage from './models/ChipUsage';
import InteractionOutcome from './models/InteractionOutcome';
import EventSuggestionFeedback from './models/EventSuggestionFeedback';
import SocialSeasonLog from './models/SocialSeasonLog';
import SocialBatteryLog from './models/SocialBatteryLog';
import JournalEntryFriend from './models/JournalEntryFriend';
import Group from './models/Group';
import GroupMember from './models/GroupMember';
import OracleInsight from './models/OracleInsight';
import OracleUsage from './models/OracleUsage';
import NetworkHealthLog from './models/NetworkHealthLog';
import EveningDigest from './models/EveningDigest';
import SharedWeaveRef from './models/SharedWeaveRef';
import SyncQueueItem from './models/SyncQueueItem';
import PendingPushNotification from './models/PendingPushNotification';
// v53: Oracle AI Infrastructure
import OracleContextCache from './models/OracleContextCache';
import JournalSignals from './models/JournalSignals';
import ProactiveInsight from './models/ProactiveInsight';
import OracleConsultation from './models/OracleConsultation';
import OracleConversation from './models/OracleConversation';
import ConversationThread from './models/ConversationThread';
import LLMQualityLog from './models/LLMQualityLog';
import UserFact from './models/UserFact';

import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import { v4 as uuidv4 } from 'uuid';

// Schema repair utility for fixing missing columns
export { repairSchemaIfNeeded } from './repair-schema';

// Configure WatermelonDB to use UUIDs for new records
setGenerator(() => uuidv4());

const adapter = new SQLiteAdapter({
  schema,
  migrations, // ENABLED: Schema migrations for interaction category system
  // dbName: 'weave',
  jsi: true, // Enable JSI for 3x performance boost
  onSetUpError: error => {
    // Database failed to load
    logger.error('Database', 'Database setup error:', error);
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
    EventSuggestionFeedback,
    SocialSeasonLog,
    SocialBatteryLog,
    JournalEntryFriend,
    Group,
    GroupMember,
    OracleInsight,
    OracleUsage,
    NetworkHealthLog,
    EveningDigest,
    SharedWeaveRef,
    SyncQueueItem,
    PendingPushNotification,
    // v53: Oracle AI Infrastructure
    OracleContextCache,
    JournalSignals,
    OracleConsultation,
    ConversationThread,
    LLMQualityLog,
    LLMQualityLog,
    ProactiveInsight,
    // v59: Conversation Persistence
    OracleConversation,
    // v56: Crystalized Memory
    UserFact,
  ],
});

export const seedDatabase = async () => {
  const friendsCollection = database.get('friends');
  const count = await friendsCollection.query().fetchCount();

  if (count > 0) {
    return;
  }

  await database.write(async () => {
    await database.get<Friend>('friends').create(friend => {
      friend.name = 'Alex Chen';
      friend.dunbarTier = 'InnerCircle';
      friend.archetype = 'Magician';
      friend.weaveScore = 50;
      friend.lastUpdated = new Date();
      friend.resilience = 1.0;
      friend.ratedWeavesCount = 0;
      friend.momentumScore = 0;
      friend.momentumLastUpdated = new Date();
      friend.isDormant = false;
      friend.outcomeCount = 0;
      friend.initiationRatio = 0.5;
      friend.consecutiveUserInitiations = 0;
      friend.totalUserInitiations = 0;
      friend.totalFriendInitiations = 0;
    });
    await database.get<Friend>('friends').create(friend => {
      friend.name = 'Sarah Martinez';
      friend.dunbarTier = 'CloseFriends';
      friend.archetype = 'Empress';
      friend.weaveScore = 50;
      friend.lastUpdated = new Date();
      friend.resilience = 1.0;
      friend.ratedWeavesCount = 0;
      friend.momentumScore = 0;
      friend.momentumLastUpdated = new Date();
      friend.isDormant = false;
      friend.outcomeCount = 0;
      friend.initiationRatio = 0.5;
      friend.consecutiveUserInitiations = 0;
      friend.totalUserInitiations = 0;
      friend.totalFriendInitiations = 0;
    });
    await database.get<Friend>('friends').create(friend => {
      friend.name = 'Jamie Thompson';
      friend.dunbarTier = 'Community';
      friend.archetype = 'Hermit';
      friend.weaveScore = 50;
      friend.lastUpdated = new Date();
      friend.resilience = 1.0;
      friend.ratedWeavesCount = 0;
      friend.momentumScore = 0;
      friend.momentumLastUpdated = new Date();
      friend.isDormant = false;
      friend.outcomeCount = 0;
      friend.initiationRatio = 0.5;
      friend.consecutiveUserInitiations = 0;
      friend.totalUserInitiations = 0;
      friend.totalFriendInitiations = 0;
    });
  });
};

/**
 * Initialize user profile singleton
 * Should be called once on app startup
 * @deprecated Use initializeAppSingletons() instead for batched writes
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
 * @deprecated Use initializeAppSingletons() instead for batched writes
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
        // Streak forgiveness mechanics (v30)
        p.lastStreakCount = 0;
        p.longestStreakEver = 0;
      });
    });
  }
};

/**
 * Initialize all app singletons in a SINGLE database.write() call
 * This prevents queue congestion at startup by batching all first-time creates
 * Should be called once on app startup
 */
export const initializeAppSingletons = async () => {
  const profileCollection = database.get<UserProfile>('user_profile');
  const progressCollection = database.get<UserProgress>('user_progress');

  // Fetch both in parallel (reads don't queue)
  const [profiles, progress] = await Promise.all([
    profileCollection.query().fetch(),
    progressCollection.query().fetch(),
  ]);

  // Collect all needed creates
  const batchOps: any[] = [];

  if (profiles.length === 0) {
    batchOps.push(
      profileCollection.prepareCreate(profile => {
        profile.batteryCheckinEnabled = true;
        profile.batteryCheckinTime = '09:00';
      })
    );
  }

  if (progress.length === 0) {
    batchOps.push(
      progressCollection.prepareCreate(p => {
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
        // Streak forgiveness mechanics (v30)
        p.lastStreakCount = 0;
        p.longestStreakEver = 0;
      })
    );
  }

  // Single write operation for all creates
  if (batchOps.length > 0) {
    await database.write(async () => {
      await database.batch(...batchOps);
    });
    logger.info('Database', `Initialized ${batchOps.length} app singletons`);
  }
};

export const clearDatabase = async () => {
  await database.write(async () => {
    // Iterate over all table names in the schema
    const tableNames = Object.keys(schema.tables);

    for (const tableName of tableNames) {
      const collection = database.get(tableName);

      // Safety check: if model is not registered, collection might be null or throw error
      if (!collection) {
        logger.warn('Database', `Skipping clear for table '${tableName}' - collection not found (check model registration)`);
        continue;
      }

      try {
        const allRecords = await collection.query().fetch();
        // Batch delete all records in this table
        const batchOps = allRecords.map(record => record.prepareDestroyPermanently());
        if (batchOps.length > 0) {
          await database.batch(...batchOps);
        }
      } catch (error) {
        logger.error('Database', `Failed to clear table '${tableName}':`, error);
      }
    }
  });

  logger.info('Database', 'All data cleared successfully');

  // Re-initialize essential singletons
  await initializeUserProfile();
  await initializeUserProgress();
};

/**
 * Initialize data migrations
 * Should be called once on app startup after database is ready
 */
export const initializeDataMigrations = async () => {
  const { runDataMigrationIfNeeded } = await import('./data-migration');
  await runDataMigrationIfNeeded(database);
};