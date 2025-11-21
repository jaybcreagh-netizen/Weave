import { Database } from '@nozbe/watermelondb';
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
    EventSuggestionFeedback,
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
        // Streak forgiveness mechanics (v30)
        p.lastStreakCount = 0;
        p.longestStreakEver = 0;
      });
    });
  }
};

export const clearDatabase = async () => {
    console.log("clearDatabase is a no-op in this new architecture");
};

/**
 * Initialize data migrations
 * Should be called once on app startup after database is ready
 */
export const initializeDataMigrations = async () => {
  const { runDataMigrationIfNeeded } = await import('./data-migration');
  await runDataMigrationIfNeeded(database);
};