import { create } from 'zustand';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import Intention from '../db/models/Intention';
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
}

export const useIntentionStore = create<IntentionStore>(() => ({
  createIntention: async (data: IntentionData): Promise<string> => {
    let intentionId = '';

    await database.write(async () => {
      const intention = await database.get<Intention>('intentions').create(i => {
        i.description = data.description;
        i.interactionCategory = data.category;
        i.status = 'active';
      });
      intentionId = intention.id;

      // Create entries in the join table for each friend
      for (const friendId of data.friendIds) {
        await database.get('intention_friends').create((intentionFriend: any) => {
          intentionFriend.intentionId = intention.id;
          intentionFriend.friendId = friendId;
        });
      }
    });

    return intentionId;
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
}));
