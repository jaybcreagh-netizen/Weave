import { create } from 'zustand';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../db/models/Friend';
import { logNewWeave } from '../lib/weave-engine';
import { type InteractionType, type InteractionCategory, type Duration, type Vibe } from '../components/types';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';

/**
 * Single reflection chip/sentence
 */
export interface ReflectionChip {
  chipId: string; // References a StoryChip ID
  componentOverrides: Record<string, string>;
}

/**
 * Structured reflection data
 * Supports multiple chips + custom notes
 */
export interface StructuredReflection {
  // Multiple selected sentence chips (array)
  chips?: ReflectionChip[];
  // Freeform custom notes (always optional)
  customNotes?: string;
}

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
  // NEW: Structured reflection data
  reflection?: StructuredReflection;
}

interface InteractionStore {
  addInteraction: (data: InteractionFormData) => Promise<string>;
  deleteInteraction: (id: string) => Promise<void>;
  updateReflection: (interactionId: string, reflection: StructuredReflection) => Promise<void>;
  updateInteractionCategory: (interactionId: string, category: InteractionCategory) => Promise<void>;
  updateInteractionVibeAndNotes: (interactionId: string, vibe?: Vibe | null, notes?: string) => Promise<void>;
}

export const useInteractionStore = create<InteractionStore>(() => ({
  addInteraction: async (data: InteractionFormData): Promise<string> => {
    // 1. Fetch the full FriendModel objects
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length > 0) {
      // 2. Pass the full form data to the engine. The engine is the expert.
      const interactionId = await logNewWeave(friends, data, database);
      return interactionId;
    }
    throw new Error('No friends found');
  },
  deleteInteraction: async (id: string) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(id);
      const joinRecords = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', id)).fetch();
      const recordsToDelete = joinRecords.map(r => r.prepareDestroyPermanently());
      await database.batch(...recordsToDelete, interaction.prepareDestroyPermanently());
    });
  },
  updateReflection: async (interactionId: string, reflection: StructuredReflection) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(interactionId);
      await interaction.update(i => {
        i.reflectionJSON = JSON.stringify(reflection);
      });
    });
  },
  updateInteractionCategory: async (interactionId: string, category: InteractionCategory) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(interactionId);
      await interaction.update(i => {
        i.interactionCategory = category;
        i.activity = category; // Update both for backward compatibility
      });
    });
  },
  updateInteractionVibeAndNotes: async (interactionId: string, vibe?: Vibe | null, notes?: string) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(interactionId);
      await interaction.update(i => {
        if (vibe !== undefined) {
          i.vibe = vibe;
        }
        if (notes !== undefined && notes.trim()) {
          i.notes = notes.trim();
        }
      });
    });
  },
}));
