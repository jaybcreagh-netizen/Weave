import { create } from 'zustand';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../db/models/Friend';
import { logNewWeave } from '../lib/weave-engine';
import { type InteractionType, type InteractionCategory, type Duration, type Vibe } from '../components/types';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { recordPractice, recordReflection, CONSISTENCY_MILESTONES, DEPTH_MILESTONES } from '../lib/milestone-tracker';
import { analyzeAndTagLifeEvents } from '../lib/life-event-detection';
import { useUIStore } from './uiStore';

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

      // 3. Record practice (updates streak) and check for milestone unlocks
      const newMilestoneIds = await recordPractice('log_weave', interactionId);

      // 4. If a new milestone was unlocked, show celebration
      if (newMilestoneIds.length > 0) {
        const milestone = CONSISTENCY_MILESTONES.find(m => m.id === newMilestoneIds[0]);
        if (milestone) {
          useUIStore.getState().showMilestoneCelebration(milestone);
        }
      }

      // 5. If reflection data exists, record it for depth tracking
      if (data.vibe || (data.notes && data.notes.trim().length > 0) || data.reflection) {
        const depthMilestoneIds = await recordReflection();

        // Show depth milestone if unlocked (only if no consistency milestone shown)
        if (depthMilestoneIds.length > 0 && newMilestoneIds.length === 0) {
          const depthMilestone = DEPTH_MILESTONES.find(m => m.id === depthMilestoneIds[0]);
          if (depthMilestone) {
            // Delay slightly so it doesn't conflict with consistency celebration
            setTimeout(() => {
              useUIStore.getState().showMilestoneCelebration(depthMilestone);
            }, 500);
          }
        }
      }

      // 6. Analyze notes/reflections for life events and auto-tag
      if (data.notes && data.notes.trim().length > 0) {
        // Run life event detection for each friend
        for (const friend of friends) {
          analyzeAndTagLifeEvents(friend.id, data.notes, data.date).catch(error => {
            console.error('Error analyzing life events:', error);
          });
        }
      }

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
    // Check if this is adding a NEW reflection (interaction previously had no vibe/notes)
    const interaction = await database.get<Interaction>('interactions').find(interactionId);
    const hadReflection = !!interaction.vibe || (interaction.note && interaction.note.trim().length > 0);
    const willHaveReflection = vibe || (notes && notes.trim().length > 0);

    await database.write(async () => {
      await interaction.update(i => {
        if (vibe !== undefined) {
          i.vibe = vibe;
        }
        if (notes !== undefined && notes.trim()) {
          i.notes = notes.trim();
        }
      });
    });

    // If this is a NEW reflection (didn't have one before), track it for depth milestones
    if (!hadReflection && willHaveReflection) {
      // Record practice (for streak tracking)
      await recordPractice('add_reflection', interactionId);

      const depthMilestoneIds = await recordReflection();

      // Show celebration if depth milestone unlocked
      if (depthMilestoneIds.length > 0) {
        const depthMilestone = DEPTH_MILESTONES.find(m => m.id === depthMilestoneIds[0]);
        if (depthMilestone) {
          useUIStore.getState().showMilestoneCelebration(depthMilestone);
        }
      }
    }

    // Analyze notes for life events if notes were added/updated
    if (notes && notes.trim().length > 0) {
      // Get friend IDs from interaction
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interactionId))
        .fetch();

      for (const intFriend of interactionFriends) {
        analyzeAndTagLifeEvents(intFriend.friendId, notes, interaction.interactionDate).catch(error => {
          console.error('Error analyzing life events:', error);
        });
      }
    }
  },
}));
