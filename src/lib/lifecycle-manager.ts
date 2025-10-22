import { database } from '../db';
import FriendModel from '../db/models/Friend';
import { calculateCurrentScore } from './weave-engine';

/**
 * Checks a list of friends and marks them as dormant if they meet the criteria.
 * @param friends An array of FriendModel objects to check.
 */
export async function checkAndApplyDormancy(friends: FriendModel[]): Promise<void> {
  const friendsToMakeDormant: FriendModel[] = [];
  const now = Date.now();
  const fortyFiveDaysInMillis = 45 * 24 * 60 * 60 * 1000;

  for (const friend of friends) {
    // Check if friend is eligible for dormancy check
    if (friend.isDormant) {
      continue;
    }

    // Check dormancy criteria
    const currentScore = calculateCurrentScore(friend);
    const timeSinceLastUpdate = now - friend.lastUpdated.getTime();

    const meetsCriteria = 
      currentScore < 35 && 
      timeSinceLastUpdate > fortyFiveDaysInMillis;

    if (meetsCriteria) {
      friendsToMakeDormant.push(friend);
    }
  }

  // If there are friends to update, perform a batch update
  if (friendsToMakeDormant.length > 0) {
    await database.write(async () => {
      for (const friendToUpdate of friendsToMakeDormant) {
        await friendToUpdate.update(record => {
          record.isDormant = true;
          record.dormantSince = new Date();
        });
      }
    });
  }
}
