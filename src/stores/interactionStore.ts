import { create } from 'zustand';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../db/models/Friend';
import { logNewWeave } from '../lib/weave-engine';
import { type InteractionType, type InteractionCategory, type Duration, type Vibe } from '../components/types';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';

// This now represents all the data collected from the form
export interface InteractionFormData {
  friendIds: string[];
  activity: string;
  notes?: string;
  date: Date;
  type: 'log' | 'plan';
  status: 'completed' | 'planned';
  mode: string; // e.g. 'one-on-one'
  vibe?: Vibe | null;
  duration?: Duration | null;
  // NEW: Simplified category system
  category?: InteractionCategory;
}

interface InteractionStore {
  addInteraction: (data: InteractionFormData) => Promise<void>;
  deleteInteraction: (id: string) => Promise<void>;
}

export const useInteractionStore = create<InteractionStore>(() => ({
  addInteraction: async (data: InteractionFormData) => {
    // 1. Fetch the full FriendModel objects
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length > 0) {
      // 2. Pass the full form data to the engine. The engine is the expert.
      await logNewWeave(friends, data, database);
    }
  },
  deleteInteraction: async (id: string) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(id);
      const joinRecords = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', id)).fetch();
      const recordsToDelete = joinRecords.map(r => r.prepareDestroyPermanently());
      await database.batch(...recordsToDelete, interaction.prepareDestroyPermanently());
    });
  },
}));
