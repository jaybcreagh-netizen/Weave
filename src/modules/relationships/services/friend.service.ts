// src/modules/relationships/services/friend.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { type FriendFormData } from '../types';
import { tierMap } from '@/shared/constants/constants';
import { trackEvent, AnalyticsEvents } from '@/lib/analytics';
import { deleteImage } from '@/lib/image-service';

export async function createFriend(data: FriendFormData): Promise<Friend> {
  let newFriend: Friend | undefined;
  try {
    await database.write(async () => {
      newFriend = await database.get<Friend>('friends').create(friend => {
        friend.name = data.name;
        friend.dunbarTier = tierMap[data.tier] || 'Community';
        friend.archetype = data.archetype;
        friend.photoUrl = data.photoUrl;
        friend.notes = data.notes;
        friend.weaveScore = 50; // Start with a neutral score
        friend.lastUpdated = new Date();
        friend.birthday = data.birthday || null;
        friend.anniversary = data.anniversary || null;
        friend.relationshipType = data.relationshipType || null;
        friend.resilience = 1.0;
        friend.ratedWeavesCount = 0;
        friend.momentumScore = 0;
        friend.momentumLastUpdated = new Date();
        friend.isDormant = false;
        friend.dormantSince = null;
      });

      const allFriends = await database.get<Friend>('friends').query().fetch();
      const archetypes = new Set(allFriends.map(f => f.archetype));

      const userProgress = await database.get('user_progress').query().fetch();
      const progress = userProgress[0];
      await progress.update(p => {
        p.curatorProgress = archetypes.size;
      });
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
  await database.write(async () => {
    const friend = await database.get<Friend>('friends').find(id);
    updatedFriend = await friend.update(record => {
      record.name = data.name;
      record.dunbarTier = tierMap[data.tier] || 'Community';
      record.archetype = data.archetype;
      record.photoUrl = data.photoUrl;
      record.notes = data.notes;
      record.birthday = data.birthday || null;
      record.anniversary = data.anniversary || null;
      record.relationshipType = data.relationshipType || null;
    });
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
      for (const contact of contacts) {
        const newFriend = await database.get<Friend>('friends').create(friend => {
          friend.name = contact.name;
          friend.dunbarTier = tier;
          friend.archetype = 'Unknown';
          friend.photoUrl = contact.photoUrl || '';
          friend.notes = '';
          friend.weaveScore = 50;
          friend.lastUpdated = new Date();
          friend.birthday = null;
          friend.anniversary = null;
          friend.relationshipType = null;
          friend.resilience = 1.0;
          friend.ratedWeavesCount = 0;
          friend.momentumScore = 0;
          friend.momentumLastUpdated = new Date();
          friend.isDormant = false;
          friend.dormantSince = null;
        });
        newFriends.push(newFriend);
      }

      const allFriends = await database.get<Friend>('friends').query().fetch();
      const archetypes = new Set(allFriends.filter(f => f.archetype !== 'Unknown').map(f => f.archetype));

      const userProgress = await database.get('user_progress').query().fetch();
      const progress = userProgress[0];
      await progress.update(p => {
        p.curatorProgress = archetypes.size;
      });
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
