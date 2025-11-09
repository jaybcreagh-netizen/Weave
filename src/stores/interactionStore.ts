import { create } from 'zustand';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../db/models/Friend';
import { logNewWeave, applyScoresForCompletedPlan } from '../lib/weave-engine';
import { type InteractionType, type InteractionCategory, type Duration, type Vibe } from '../components/types';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { recordPractice, recordReflection, CONSISTENCY_MILESTONES, DEPTH_MILESTONES } from '../lib/milestone-tracker';
import { analyzeAndTagLifeEvents } from '../lib/life-event-detection';
import { useUIStore } from './uiStore';
import { deleteWeaveCalendarEvent, updateWeaveCalendarEvent, getCalendarSettings } from '../lib/calendar-service';
import { getCategoryMetadata } from '../lib/interaction-categories';

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
  // v17: Custom title and location
  title?: string;
  location?: string;
}

interface InteractionStore {
  addInteraction: (data: InteractionFormData) => Promise<string>;
  deleteInteraction: (id: string) => Promise<void>;
  updateReflection: (interactionId: string, reflection: StructuredReflection) => Promise<void>;
  updateInteractionCategory: (interactionId: string, category: InteractionCategory) => Promise<void>;
  updateInteractionVibeAndNotes: (interactionId: string, vibe?: Vibe | null, notes?: string) => Promise<void>;
  updateInteraction: (interactionId: string, updates: {
    title?: string;
    category?: InteractionCategory;
    vibe?: Vibe | null;
    reflection?: StructuredReflection;
    date?: Date;
    location?: string;
    notes?: string;
  }) => Promise<void>;
  confirmPlan: (interactionId: string) => Promise<void>;
  updatePlanStatus: (interactionId: string, status: 'planned' | 'pending_confirm' | 'completed' | 'cancelled' | 'missed') => Promise<void>;
}

export const useInteractionStore = create<InteractionStore>(() => ({
  addInteraction: async (data: InteractionFormData): Promise<string> => {
    // 1. Fetch the full FriendModel objects
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length > 0) {
      // 2. Pass the full form data to the engine. The engine is the expert.
      const { interactionId, badgeUnlocks, achievementUnlocks } = await logNewWeave(friends, data, database);

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

      // 6. Queue badge and achievement unlock celebrations
      // Badge unlocks are shown first, then achievements
      if (badgeUnlocks.length > 0) {
        useUIStore.getState().queueBadgeUnlocks(badgeUnlocks);
      }
      if (achievementUnlocks.length > 0) {
        useUIStore.getState().queueAchievementUnlocks(achievementUnlocks);
      }

      // 7. Analyze notes/reflections for life events and auto-tag
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
    // First, get the interaction to check for calendar event
    const interaction = await database.get<Interaction>('interactions').find(id);
    const calendarEventId = interaction.calendarEventId;

    // Delete from database
    await database.write(async () => {
      const joinRecords = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', id)).fetch();
      const recordsToDelete = joinRecords.map(r => r.prepareDestroyPermanently());
      await database.batch(...recordsToDelete, interaction.prepareDestroyPermanently());
    });

    // Delete calendar event if it exists (don't await - do in background)
    if (calendarEventId) {
      deleteWeaveCalendarEvent(calendarEventId).catch(err => {
        console.warn('Failed to delete calendar event:', err);
      });
    }
  },
  updateReflection: async (interactionId: string, reflection: StructuredReflection) => {
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(interactionId);
      await interaction.update(i => {
        i.reflectionJSON = JSON.stringify(reflection);
      });

      if (reflection.customNotes && reflection.customNotes.length >= 100) {
        const userProgress = await database.get('user_progress').query().fetch();
        const progress = userProgress[0];
        await progress.update(p => {
          p.highPriestessProgress += 1;
        });
      }
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
  confirmPlan: async (interactionId: string) => {
    // 1. Update status to completed
    await database.write(async () => {
      const interaction = await database.get<Interaction>('interactions').find(interactionId);
      await interaction.update(i => {
        i.status = 'completed';
      });
    });

    // 2. Apply weave scores retroactively
    await applyScoresForCompletedPlan(interactionId, database);

    // 3. Record practice for milestone tracking
    const newMilestoneIds = await recordPractice('log_weave', interactionId);

    // 4. Show milestone celebration if unlocked
    if (newMilestoneIds.length > 0) {
      const milestone = CONSISTENCY_MILESTONES.find(m => m.id === newMilestoneIds[0]);
      if (milestone) {
        useUIStore.getState().showMilestoneCelebration(milestone);
      }
    }

    console.log(`✓ Plan ${interactionId} confirmed and scored`);
  },
  updateInteraction: async (interactionId: string, updates: {
    title?: string;
    category?: InteractionCategory;
    vibe?: Vibe | null;
    reflection?: StructuredReflection;
    date?: Date;
    location?: string;
    notes?: string;
  }) => {
    // Get the interaction first to check for calendar sync needs
    const interaction = await database.get<Interaction>('interactions').find(interactionId);
    const calendarEventId = interaction.calendarEventId;
    const isPlanned = interaction.status === 'planned' || interaction.status === 'pending_confirm';

    // Update database
    await database.write(async () => {
      await interaction.update(i => {
        if (updates.title !== undefined) {
          i.title = updates.title;
        }
        if (updates.category !== undefined) {
          i.interactionCategory = updates.category;
          i.activity = updates.category; // Update both for backward compatibility
        }
        if (updates.vibe !== undefined) {
          i.vibe = updates.vibe;
        }
        if (updates.reflection !== undefined) {
          i.reflectionJSON = JSON.stringify(updates.reflection);
        }
        if (updates.date !== undefined) {
          i.interactionDate = updates.date;
        }
        if (updates.location !== undefined) {
          i.location = updates.location;
        }
        if (updates.notes !== undefined) {
          i.notes = updates.notes;
        }
      });
    });

    // Update calendar event if this is a planned interaction with a calendar event
    if (calendarEventId && isPlanned) {
      const calendarUpdates: any = {};

      // Check if we need to update calendar
      const needsCalendarUpdate =
        updates.title !== undefined ||
        updates.date !== undefined ||
        updates.location !== undefined ||
        updates.notes !== undefined;

      if (needsCalendarUpdate) {
        try {
          const settings = await getCalendarSettings();
          if (settings.enabled) {
            // Get friend names for calendar event
            const interactionFriends = await database
              .get<InteractionFriend>('interaction_friends')
              .query(Q.where('interaction_id', interactionId))
              .fetch();

            const friendIds = interactionFriends.map(ifriend => ifriend.friendId);
            const friends = await database
              .get<FriendModel>('friends')
              .query(Q.where('id', Q.oneOf(friendIds)))
              .fetch();

            const friendNames = friends.map(f => f.name).join(', ');

            // Prepare calendar updates
            if (updates.title !== undefined || updates.category !== undefined) {
              const category = updates.category || interaction.interactionCategory;
              const categoryMeta = getCategoryMetadata(category as InteractionCategory);
              const eventTitle = updates.title || interaction.title || `${categoryMeta?.label || category}`;
              calendarUpdates.title = `🧵 Weave with ${friendNames} - ${eventTitle}`;
            }

            if (updates.date !== undefined) {
              calendarUpdates.date = updates.date;
            }

            if (updates.location !== undefined) {
              calendarUpdates.location = updates.location;
            }

            if (updates.notes !== undefined) {
              calendarUpdates.notes = updates.notes;
            }

            // Update the calendar event
            await updateWeaveCalendarEvent(calendarEventId, calendarUpdates);
          }
        } catch (calendarError) {
          console.warn('Failed to update calendar event:', calendarError);
        }
      }
    }
  },
  updatePlanStatus: async (interactionId: string, status: 'planned' | 'pending_confirm' | 'completed' | 'cancelled' | 'missed') => {
    // Get interaction first to check for calendar event
    const interaction = await database.get<Interaction>('interactions').find(interactionId);
    const calendarEventId = interaction.calendarEventId;
    const previousStatus = interaction.status;

    // Update database
    await database.write(async () => {
      await interaction.update(i => {
        i.status = status;
      });

      if (status === 'completed') {
        const userProgress = await database.get('user_progress').query().fetch();
        const progress = userProgress[0];
        await progress.update(p => {
          p.catalystProgress += 1;
        });
      }
    });

    // Apply weave scores if transitioning from planned/pending_confirm to completed
    if (status === 'completed' && (previousStatus === 'planned' || previousStatus === 'pending_confirm')) {
      await applyScoresForCompletedPlan(interactionId, database);

      // Record practice for milestone tracking
      const newMilestoneIds = await recordPractice('log_weave', interactionId);

      // Show milestone celebration if unlocked
      if (newMilestoneIds.length > 0) {
        const milestone = CONSISTENCY_MILESTONES.find(m => m.id === newMilestoneIds[0]);
        if (milestone) {
          useUIStore.getState().showMilestoneCelebration(milestone);
        }
      }

      console.log(`✓ Plan ${interactionId} completed and scored`);
    }

    // Handle calendar event based on new status
    if (calendarEventId) {
      // Delete calendar event if plan is cancelled or missed
      if (status === 'cancelled' || status === 'missed') {
        deleteWeaveCalendarEvent(calendarEventId).catch(err => {
          console.warn('Failed to delete calendar event:', err);
        });
      }
      // Note: For 'completed' status, we keep the calendar event as a record
      // For 'pending_confirm', we keep it active since plan might still happen
    }
  },
}));
