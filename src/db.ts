import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './db/schema';
import migrations from './db/migrations';
import Friend from './db/models/Friend';
import Interaction from './db/models/Interaction';
import InteractionFriend from './db/models/InteractionFriend';
import SuggestionEvent from './db/models/SuggestionEvent';
import Intention from './db/models/Intention';
import UserProfile from './db/models/UserProfile';
import PracticeLog from './db/models/PracticeLog';
import LifeEvent from './db/models/LifeEvent';

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
    UserProfile,
    PracticeLog,
    LifeEvent,
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

export const clearDatabase = async () => {
    console.log("clearDatabase is a no-op in this new architecture");
};

/**
 * Initialize data migrations
 * Should be called once on app startup after database is ready
 */
export const initializeDataMigrations = async () => {
  const { runDataMigrationIfNeeded } = await import('./db/data-migration');
  await runDataMigrationIfNeeded(database);
};