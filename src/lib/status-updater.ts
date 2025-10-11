import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import Friend from '../db/models/Friend';
import Interaction from '../db/models/Interaction';
import { type Tier, type Status } from '../components/types';
import { calculateOverallStatus, calculateNextConnectionDate } from './timeline-utils';
import { format } from 'date-fns';

function generateStatusText(friend: Friend, interactions: Interaction[]): string {
    const tier = friend.tier as Tier;
  
    if (interactions.length === 0) {
      const firstContactDate = friend.createdAt;
      const nextConnectionDate = calculateNextConnectionDate(firstContactDate, tier);
      return `Weave began: ${format(firstContactDate, 'MMM d')}. Nurture by: ${format(nextConnectionDate, 'MMM d')}`;
    }
  
    const mostRecentInteraction = interactions.reduce((latest, current) => {
      return new Date(current.date) > new Date(latest.date) ? current : latest;
    });
  
    const lastInteractionDate = new Date(mostRecentInteraction.date);
    const nextConnectionDate = calculateNextConnectionDate(lastInteractionDate, tier);
  
    return `Presence felt: ${format(lastInteractionDate, 'MMM d')}. Reconnect by: ${format(nextConnectionDate, 'MMM d')}`;
}


export const updateAllFriendStatuses = async () => {
    const allFriends = await database.get<Friend>('friends').query().fetch();
    const updates: { friend: Friend, newStatus: Status, newStatusText: string }[] = [];
  
    for (const friend of allFriends) {
      const interactions = await friend.interactions.fetch();
      const connectionStatus = calculateOverallStatus(interactions, friend.tier as Tier);
      const newStatusText = generateStatusText(friend, interactions);
  
      if (friend.status !== connectionStatus.status || friend.statusText !== newStatusText) {
        updates.push({
          friend,
          newStatus: connectionStatus.status,
          newStatusText,
        });
      }
    }
  
    if (updates.length > 0) {
      await database.write(async () => {
        for (const update of updates) {
          await update.friend.update(record => {
            record.status = update.newStatus;
            record.statusText = update.newStatusText;
          });
        }
      });
    }
};

export const updateStatusForFriend = async (friendId: string) => {
    const friend = await database.get<Friend>('friends').find(friendId);
    if (!friend) return;

    const interactions = await friend.interactions.fetch();
    const connectionStatus = calculateOverallStatus(interactions, friend.tier as Tier);
    const newStatusText = generateStatusText(friend, interactions);

    if (friend.status !== connectionStatus.status || friend.statusText !== newStatusText) {
        await database.write(async () => {
            await friend.update(record => {
                record.status = connectionStatus.status;
                record.statusText = newStatusText;
            });
        });
    }
}