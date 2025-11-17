import { database } from '../db';
import FriendModel from '../db/models/Friend';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import Intention from '../db/models/Intention';
import { Q } from '@nozbe/watermelondb';

/**
 * Check if friend has any active intentions
 * Returns true if they have active intentions
 */
async function hasActiveIntentions(friendId: string): Promise<boolean> {
  try {
    // Get active intentions for this friend through join table
    const intentionFriends = await database
      .get('intention_friends')
      .query(Q.where('friend_id', friendId))
      .fetch();

    if (intentionFriends.length === 0) return false;

    // Get intention IDs
    const intentionIds = intentionFriends.map((ifriend: any) => ifriend._raw.intention_id);

    // Check if any are active
    const activeIntentions = await database
      .get<Intention>('intentions')
      .query(
        Q.where('id', Q.oneOf(intentionIds)),
        Q.where('status', 'active')
      )
      .fetch();

    return activeIntentions.length > 0;
  } catch (error) {
    console.error('Error checking active intentions:', error);
    return false;
  }
}

/**
 * Checks a list of friends and marks them as dormant if they meet the criteria.
 * Also reactivates friends who no longer meet dormancy criteria.
 * Friends with active intentions get extended grace period (+30 days).
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

    // Check if friend has active intentions (gives +30 day grace period)
    const hasIntentions = await hasActiveIntentions(friend.id);
    const inactivityThreshold = hasIntentions
      ? ninetyDaysInMillis + (30 * 24 * 60 * 60 * 1000) // +30 days if intentions exist
      : ninetyDaysInMillis;

    // Dormancy criteria: score < 25 (lowered threshold) AND 90-120+ days of inactivity (depending on intentions)
    // Friends with active intentions get extended grace period
    const meetsCriteria =
      !isInnerCircle &&
      !hasIntentions && // Cannot go dormant while intentions are active
      currentScore < 25 &&
      timeSinceLastUpdate > inactivityThreshold;

    if (!friend.isDormant && meetsCriteria) {
      // Mark as dormant
      friendsToMakeDormant.push(friend);
    } else if (friend.isDormant && !meetsCriteria) {
      // Reactivate if no longer meets criteria (e.g., new intention was set)
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
