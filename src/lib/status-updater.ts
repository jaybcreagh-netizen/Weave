import { db } from '../db';
import { type Status, type Tier } from '../components/types';
import { calculateOverallStatus } from './timeline-utils';

// NEW, more efficient function for updating specific friends
export async function updateStatusesForFriends(friendIds: string[]) {
  if (!friendIds || friendIds.length === 0) return;

  const friendsToUpdate = await db.friends.bulkGet(friendIds);

  for (const friend of friendsToUpdate) {
    if (!friend) continue;
    
    const interactions = await db.interactions.where('friendIds').equals(friend.id).toArray();
    const connectionStatus = calculateOverallStatus(interactions, friend.tier as Tier);
    
    if (friend.status !== connectionStatus.status || friend.statusText !== connectionStatus.statusText) {
      await db.friends.update(friend.id, { 
        status: connectionStatus.status,
        statusText: connectionStatus.statusText,
        updatedAt: new Date(),
      });
    }
  }
}

export const updateAllFriendStatuses = async () => {
  const friends = await db.friends.toArray();
  
  for (const friend of friends) {
    const interactions = await db.interactions
      .where('friendIds')
      .equals(friend.id)
      .toArray();
    
    const connectionStatus = calculateOverallStatus(interactions, friend.tier as Tier);
    
    if (friend.status !== connectionStatus.status || friend.statusText !== connectionStatus.statusText) {
      await db.friends.update(friend.id, {
        status: connectionStatus.status,
        statusText: connectionStatus.statusText,
        updatedAt: new Date(),
      });
    }
  }
};