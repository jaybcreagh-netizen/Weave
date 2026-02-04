// src/modules/relationships/services/friend.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import UserProgress from '@/db/models/UserProgress';
import { Q } from '@nozbe/watermelondb';
import { type FriendFormData } from '../types';
import { getTierCapacity, getTierDisplayName, tierMap } from '@/shared/constants/constants';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { deleteImage, getRelativePath } from './image.service';
import { writeScheduler } from '@/shared/services/write-scheduler';

type DunbarTier = 'InnerCircle' | 'CloseFriends' | 'Community';

export interface BatchAddContactInput {
  name: string;
  photoUrl?: string;
  phoneNumber?: string;
  email?: string;
}

export interface RejectedBatchFriend {
  name: string;
  requestedTier: DunbarTier;
  reason: string;
}

export interface BatchAddFriendsResult {
  added: Friend[];
  rejected: RejectedBatchFriend[];
}

function normalizeTier(tier: string): DunbarTier {
  return (tierMap[tier] || 'Community') as DunbarTier;
}

async function getCurrentTierCount(tier: DunbarTier, excludeFriendId?: string): Promise<number> {
  const clauses: any[] = [
    Q.where('dunbar_tier', tier),
    Q.where('is_dormant', false),
  ];

  if (excludeFriendId) {
    clauses.push(Q.where('id', Q.notEq(excludeFriendId)));
  }

  return database.get<Friend>('friends').query(...clauses).fetchCount();
}

export async function checkTierCapacity(tier: string, excludeFriendId?: string): Promise<boolean> {
  const normalizedTier = normalizeTier(tier);
  const currentCount = await getCurrentTierCount(normalizedTier, excludeFriendId);
  return currentCount < getTierCapacity(normalizedTier);
}

async function isTierAtCapacity(tier: string, excludeFriendId?: string): Promise<boolean> {
  const hasCapacity = await checkTierCapacity(tier, excludeFriendId);
  return !hasCapacity;
}

export async function createFriend(data: FriendFormData, source: 'manual' | 'onboarding' | 'import' = 'manual'): Promise<Friend> {
  let newFriend: Friend | undefined;
  const targetTier = normalizeTier(data.tier);
  try {
    if (await isTierAtCapacity(targetTier)) {
      throw new Error(`${getTierDisplayName(targetTier)} is at capacity (${getTierCapacity(targetTier)})`);
    }

    // IMPORTANT PRIORITY: User-initiated action
    await writeScheduler.important('createFriend', async () => {
      const batchOps: any[] = [];

      newFriend = database.get<Friend>('friends').prepareCreate(friend => {
        friend.name = data.name;
        friend.dunbarTier = targetTier;
        friend.archetype = data.archetype;
        friend.photoUrl = getRelativePath(data.photoUrl || '');
        friend.notes = data.notes;
        friend.weaveScore = 50; // Start with a neutral score (Green)
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

        // Contact details
        friend.phoneNumber = data.phoneNumber;
        friend.email = data.email;
        friend.preferredMessagingApp = data.preferredMessagingApp;
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
      source: source,
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
  const oldTier = normalizeTier(friend.dunbarTier);
  const newTier = normalizeTier(data.tier);

  if (newTier !== oldTier && await isTierAtCapacity(newTier, id)) {
    throw new Error(`Cannot move to ${getTierDisplayName(newTier)} - at capacity`);
  }

  // IMPORTANT PRIORITY: User-initiated action
  await writeScheduler.important('updateFriend', async () => {
    updatedFriend = await friend.update(record => {
      record.name = data.name;
      record.dunbarTier = newTier;
      record.archetype = data.archetype;
      record.photoUrl = getRelativePath(data.photoUrl || '');
      record.notes = data.notes;
      record.birthday = data.birthday || undefined;
      record.anniversary = data.anniversary || undefined;
      record.relationshipType = data.relationshipType || undefined;

      // Contact details
      record.phoneNumber = data.phoneNumber;
      record.email = data.email;
      record.preferredMessagingApp = data.preferredMessagingApp;

      record.lastUpdated = new Date();
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

  // CRITICAL PRIORITY: User-initiated destructive action
  await writeScheduler.critical('deleteFriend', async () => {
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

export async function batchAddFriends(
  contacts: BatchAddContactInput[],
  tier: string
): Promise<BatchAddFriendsResult> {
  const newFriends: Friend[] = [];
  const rejected: RejectedBatchFriend[] = [];
  const BATCH_SIZE = 500;
  const requestedTier = normalizeTier(tier);

  const currentCount = await getCurrentTierCount(requestedTier);
  const capacity = getTierCapacity(requestedTier);
  const availableSlots = Math.max(0, capacity - currentCount);

  const acceptedContacts = contacts.slice(0, availableSlots);
  for (const contact of contacts.slice(availableSlots)) {
    rejected.push({
      name: contact.name,
      requestedTier,
      reason: `${getTierDisplayName(requestedTier)} is at capacity (${capacity})`,
    });
  }

  if (acceptedContacts.length === 0) {
    return { added: [], rejected };
  }

  try {
    for (let i = 0; i < acceptedContacts.length; i += BATCH_SIZE) {
      const chunk = acceptedContacts.slice(i, i + BATCH_SIZE);

      // IMPORTANT PRIORITY: User-initiated bulk action
      await writeScheduler.important('batchAddFriends', async () => {
        const batchOps: any[] = [];

        for (const contact of chunk) {
          const newFriend = database.get<Friend>('friends').prepareCreate(friend => {
            friend.name = contact.name;
            friend.dunbarTier = requestedTier;
            friend.archetype = 'Unknown';
            friend.photoUrl = getRelativePath(contact.photoUrl || '');
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

            // Save contact details for future matching
            friend.phoneNumber = contact.phoneNumber;
            friend.email = contact.email;
          });
          newFriends.push(newFriend);
          batchOps.push(newFriend);
        }

        const allFriends = await database.get<Friend>('friends').query().fetch();
        const archetypes = new Set(allFriends.filter(f => f.archetype !== 'Unknown').map(f => f.archetype));

        const userProgress = await database.get<UserProgress>('user_progress').query().fetch();
        if (userProgress.length > 0) {
          const progress = userProgress[0];
          batchOps.push(progress.prepareUpdate(p => {
            p.curatorProgress = archetypes.size;
          }));
        }

        await database.batch(batchOps);
      });
    }

    trackEvent(AnalyticsEvents.FRIEND_BATCH_ADDED, {
      count: acceptedContacts.length,
      tier: requestedTier,
      source: 'batch_import',
    });
  } catch (error) {
    console.error('[batchAddFriends] ERROR: Failed to create friends.', error);
    throw error;
  }

  return { added: newFriends, rejected };
}
