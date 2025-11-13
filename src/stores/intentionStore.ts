import { create } from 'zustand';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import Intention from '../db/models/Intention';
import IntentionFriend from '../db/models/IntentionFriend';
import { InteractionCategory } from '../components/types';

interface IntentionData {
  friendIds: string[];
  description?: string;
  category?: InteractionCategory;
}

interface IntentionStore {
  createIntention: (data: IntentionData) => Promise<string>;
  dismissIntention: (intentionId: string) => Promise<void>;
  convertToPlannedWeave: (intentionId: string) => Promise<void>;
  getActiveIntentions: () => Promise<Intention[]>;
  getFriendIntentions: (friendId: string) => Promise<Intention[]>;
  updateLastReminded: (intentionId: string) => Promise<void>;
  clearAllIntentions: () => Promise<void>;
  cleanupOrphanedIntentions: () => Promise<number>;
}

export const useIntentionStore = create<IntentionStore>(() => ({
  createIntention: async (data: IntentionData): Promise<string> => {
    console.log('[IntentionStore] Creating intention with data:', data);
    let intentionId = '';

    try {
      await database.write(async () => {
        const intention = await database.get<Intention>('intentions').create(i => {
          i.description = data.description;
          i.interactionCategory = data.category;
          i.status = 'active';
        });
        intentionId = intention.id;
        console.log('[IntentionStore] Created intention with ID:', intentionId);

        // Create entries in the join table for each friend
        for (const friendId of data.friendIds) {
          await database.get<IntentionFriend>('intention_friends').create((intentionFriend: IntentionFriend) => {
            intentionFriend.intentionId = intention.id;
            intentionFriend.friendId = friendId;
          });
          console.log('[IntentionStore] Created intention_friend link for:', friendId);
        }
      });

      console.log('[IntentionStore] Successfully created intention:', intentionId);
      return intentionId;
    } catch (error) {
      console.error('[IntentionStore] Error creating intention:', error);
      throw error;
    }
  },

  dismissIntention: async (intentionId: string) => {
    await database.write(async () => {
      const intention = await database.get<Intention>('intentions').find(intentionId);
      await intention.update(i => {
        i.status = 'dismissed';
      });
    });
  },

  convertToPlannedWeave: async (intentionId: string) => {
    await database.write(async () => {
      const intention = await database.get<Intention>('intentions').find(intentionId);
      await intention.update(i => {
        i.status = 'converted';
      });
    });
  },

  getActiveIntentions: async (): Promise<Intention[]> => {
    return await database
      .get<Intention>('intentions')
      .query(Q.where('status', 'active'))
      .fetch();
  },

  getFriendIntentions: async (friendId: string): Promise<Intention[]> => {
    const intentionFriends = await database
      .get('intention_friends')
      .query(Q.where('friend_id', friendId))
      .fetch();

    const intentionIds = intentionFriends.map(ifriend => ifriend.intention.id);

    return await database
      .get<Intention>('intentions')
      .query(
        Q.where('id', Q.oneOf(intentionIds)),
        Q.where('status', 'active')
      )
      .fetch();
  },

  updateLastReminded: async (intentionId: string) => {
    await database.write(async () => {
      const intention = await database.get<Intention>('intentions').find(intentionId);
      await intention.update(i => {
        i.lastRemindedAt = new Date();
      });
    });
  },

  clearAllIntentions: async () => {
    console.log('[IntentionStore] Clearing all active intentions');
    await database.write(async () => {
      const activeIntentions = await database
        .get<Intention>('intentions')
        .query(Q.where('status', 'active'))
        .fetch();

      for (const intention of activeIntentions) {
        await intention.update(i => {
          i.status = 'dismissed';
        });
      }
    });
    console.log('[IntentionStore] Cleared all intentions');
  },

  cleanupOrphanedIntentions: async (): Promise<number> => {
    console.log('[IntentionStore] Cleaning up orphaned intentions...');
    let cleanedCount = 0;

    try {
      // Get all active intentions
      const activeIntentions = await database
        .get<Intention>('intentions')
        .query(Q.where('status', 'active'))
        .fetch();

      await database.write(async () => {
        for (const intention of activeIntentions) {
          // Check if this intention has any associated friends
          const intentionFriends = await database
            .get('intention_friends')
            .query(Q.where('intention_id', intention.id))
            .fetch();

          // If no friends associated, mark as dismissed
          if (intentionFriends.length === 0) {
            await intention.update(i => {
              i.status = 'dismissed';
            });
            cleanedCount++;
            console.log('[IntentionStore] Cleaned orphaned intention:', intention.id);
          }
        }
      });

      console.log(`[IntentionStore] Cleanup complete. Removed ${cleanedCount} orphaned intentions`);
      return cleanedCount;
    } catch (error) {
      console.error('[IntentionStore] Error cleaning up orphaned intentions:', error);
      throw error;
    }
  },
}));
