import { database } from '../db';
import FriendModel from '../db/models/Friend';
import { calculateCurrentScore } from './weave-engine';

/**
 * Checks a list of friends and marks them as dormant if they meet the criteria.
 * Also reactivates friends who no longer meet dormancy criteria.
 * @param friends An array of FriendModel objects to check.
 */
export async function checkAndApplyDormancy(friends: FriendModel[]): Promise<void> {
  const friendsToMakeDormant: FriendModel[] = [];
  const friendsToReactivate: FriendModel[] = [];
  const now = Date.now();
  const ninetyDaysInMillis = 90 * 24 * 60 * 60 * 1000; // Increased from 45 to 90 days

  for (const friend of friends) {
    const currentScore = calculateCurrentScore(friend);
    const timeSinceLastUpdate = now - friend.lastUpdated.getTime();

    // Inner Circle friends are exempt from dormancy
    const isInnerCircle = friend.dunbarTier === 'InnerCircle';

    // Dormancy criteria: score < 25 (lowered threshold) AND 90+ days of inactivity
    const meetsCriteria =
      !isInnerCircle &&
      currentScore < 25 &&
      timeSinceLastUpdate > ninetyDaysInMillis;

    if (!friend.isDormant && meetsCriteria) {
      // Mark as dormant
      friendsToMakeDormant.push(friend);
    } else if (friend.isDormant && !meetsCriteria) {
      // Reactivate if no longer meets criteria
      friendsToReactivate.push(friend);
    }
  }

  // Perform batch updates
  if (friendsToMakeDormant.length > 0 || friendsToReactivate.length > 0) {
    await database.write(async () => {
      for (const friendToUpdate of friendsToMakeDormant) {
        await friendToUpdate.update(record => {
          record.isDormant = true;
          record.dormantSince = new Date();
        });
      }

      for (const friendToReactivate of friendsToReactivate) {
        await friendToReactivate.update(record => {
          record.isDormant = false;
          record.dormantSince = null;
        });
      }
    });

    if (friendsToReactivate.length > 0) {
      console.log(`🔄 Reactivated ${friendsToReactivate.length} friends who no longer meet dormancy criteria`);
    }
  }
}
