// src/modules/relationships/services/friend.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import UserProgress from '@/db/models/UserProgress';
import { Q } from '@nozbe/watermelondb';
import { type FriendFormData } from '../types';
import { tierMap } from '@/shared/constants/constants';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { deleteImage } from './image.service';

export async function createFriend(data: FriendFormData): Promise<Friend> {
  let newFriend: Friend | undefined;
  try {
    await database.write(async () => {
      const batchOps: any[] = [];

      newFriend = database.get<Friend>('friends').prepareCreate(friend => {
        friend.name = data.name;
        friend.dunbarTier = tierMap[data.tier] || 'Community';
        friend.archetype = data.archetype;
        friend.photoUrl = data.photoUrl;
        friend.notes = data.notes;
        friend.weaveScore = 50; // Start with a neutral score
        friend.lastUpdated = new Date();
        friend.birthday = data.birthday || undefined;
        friend.anniversary = data.anniversary || undefined;
        friend.relationshipType = data.relationshipType || undefined;
        friend.resilience = 1.0;
        friend.ratedWeavesCount = 0;
        friend.momentumScore = 0;
        friend.momentumLastUpdated = new Date();
        friend.isDormant = false;
        friend.dormantSince = undefined;
      });
      batchOps.push(newFriend);

      const allFriends = await database.get<Friend>('friends').query().fetch();
      // Note: allFriends won't include the newFriend yet since it's not committed.
      // We need to account for that manually or accept it updates on next sync/action.
      // Since we are just counting archetypes, we can check the new friend's archetype.
      const archetypes = new Set(allFriends.map(f => f.archetype));
      archetypes.add(data.archetype);

      const userProgress = await database.get<UserProgress>('user_progress').query().fetch();
      if (userProgress.length > 0) {
        const progress = userProgress[0];
        batchOps.push(progress.prepareUpdate(p => {
          p.curatorProgress = archetypes.size;
        }));
      }

      await database.batch(batchOps);
    });

    trackEvent(AnalyticsEvents.FRIEND_ADDED, {
      archetype: data.archetype,
      tier: data.tier,
      source: 'manual',
      has_photo: !!data.photoUrl,
      has_notes: !!data.notes,
    });
  } catch (error) {
    console.error('[createFriend] ERROR: Failed to create friend.', error);
    throw error;
  }
  return newFriend!;
}

export async function updateFriend(id: string, data: FriendFormData): Promise<Friend> {
  let updatedFriend: Friend | undefined;
  const friend = await database.get<Friend>('friends').find(id);
  updatedFriend = await friend.update(record => {
    record.name = data.name;
    record.dunbarTier = tierMap[data.tier] || 'Community';
    record.archetype = data.archetype;
    record.photoUrl = data.photoUrl;
    record.notes = data.notes;
    record.birthday = data.birthday || undefined;
    record.anniversary = data.anniversary || undefined;
    record.relationshipType = data.relationshipType || undefined;
  });

  trackEvent(AnalyticsEvents.FRIEND_UPDATED, {
    archetype: data.archetype,
    tier: data.tier,
  });
  return updatedFriend!;
}

export async function deleteFriend(id: string): Promise<void> {
  const friend = await database.get<Friend>('friends').find(id);
  const photoUrl = friend.photoUrl;

  await database.write(async () => {
    await friend.destroyPermanently();
  });

  if (photoUrl) {
    try {
      await deleteImage({
        imageId: id,
        type: 'profilePicture',
      });
    } catch (error) {
      console.error('[deleteFriend] Error deleting profile picture:', error);
    }
  }

  trackEvent(AnalyticsEvents.FRIEND_DELETED);
}

export async function batchAddFriends(contacts: Array<{ name: string; photoUrl?: string }>, tier: any): Promise<Friend[]> {
  const newFriends: Friend[] = [];
  try {
    await database.write(async () => {
      const batchOps: any[] = [];

      for (const contact of contacts) {
        const newFriend = database.get<Friend>('friends').prepareCreate(friend => {
          friend.name = contact.name;
          friend.dunbarTier = tier;
          friend.archetype = 'Unknown';
          friend.photoUrl = contact.photoUrl || '';
          friend.notes = '';
          friend.weaveScore = 50;
          friend.lastUpdated = new Date();
          friend.birthday = undefined;
          friend.anniversary = undefined;
          friend.relationshipType = undefined;
          friend.resilience = 1.0;
          friend.ratedWeavesCount = 0;
          friend.momentumScore = 0;
          friend.momentumLastUpdated = new Date();
          friend.isDormant = false;
          friend.dormantSince = undefined;
        });
        newFriends.push(newFriend);
        batchOps.push(newFriend);
      }

      const allFriends = await database.get<Friend>('friends').query().fetch();
      const archetypes = new Set(allFriends.filter(f => f.archetype !== 'Unknown').map(f => f.archetype));
      // New friends are all 'Unknown' so they don't affect archetype count unless we had 0 before? 
      // Actually 'Unknown' is excluded in the filter above.

      const userProgress = await database.get<UserProgress>('user_progress').query().fetch();
      if (userProgress.length > 0) {
        const progress = userProgress[0];
        batchOps.push(progress.prepareUpdate(p => {
          p.curatorProgress = archetypes.size;
        }));
      }

      await database.batch(batchOps);
    });

    trackEvent(AnalyticsEvents.FRIEND_BATCH_ADDED, {
      count: contacts.length,
      tier: tier,
      source: 'batch_import',
    });
  } catch (error) {
    console.error('[batchAddFriends] ERROR: Failed to create friends.', error);
    throw error;
  }
  return newFriends;
}
