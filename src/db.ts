import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './db/schema';
import Friend from './db/models/Friend';
import Interaction from './db/models/Interaction';

const adapter = new SQLiteAdapter({
  schema,
  // migrations,
  // dbName: 'weave',
  // jsi: true,
  onSetUpError: error => {
    // Database failed to load
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Friend,
    Interaction,
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

export const clearDatabase = async () => {
    console.log("clearDatabase is a no-op in this new architecture");
};