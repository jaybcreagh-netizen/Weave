import { create } from 'zustand';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import { Subscription } from 'rxjs';
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
import { recordReflectionChips } from '../lib/adaptive-chips';
import { syncCalendarChanges, type CalendarSyncResult } from '../lib/calendar-sync-service';

/**
 * Calendar event update payload
 */
interface CalendarEventUpdate {
  title?: string;
  date?: Date;
  location?: string;
  notes?: string;
}

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
  // v24: Event importance for special occasions
  eventImportance?: 'low' | 'medium' | 'high' | 'critical';
  // v25: Reciprocity tracking
  initiator?: 'user' | 'friend' | 'mutual';
}

interface InteractionStore {
  allInteractions: Interaction[];
  observeAllInteractions: () => void;
  unobserveAllInteractions: () => void;
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
  // Calendar sync
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncWithCalendar: () => Promise<CalendarSyncResult | null>;
}

let allInteractionsSubscription: Subscription | null = null;

export const useInteractionStore = create<InteractionStore>((set, get) => ({
  allInteractions: [],
  isSyncing: false,
  lastSyncTime: null,

  observeAllInteractions: () => {
    if (allInteractionsSubscription) return;

    allInteractionsSubscription = database
      .get<Interaction>('interactions')
      .query(Q.sortBy('interaction_date', Q.desc))
      .observe()
      .subscribe((interactions) => {
        set({ allInteractions: interactions });
      });
  },

  unobserveAllInteractions: () => {
    if (allInteractionsSubscription) {
      allInteractionsSubscription.unsubscribe();
      allInteractionsSubscription = null;
    }
    set({ allInteractions: [] });
  },

  addInteraction: async (data: InteractionFormData): Promise<string> => {
    // 1. Fetch the full FriendModel objects
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length > 0) {
      // 2. Pass the full form data to the engine. The engine is the expert.
      const { interactionId, badgeUnlocks, achievementUnlocks } = await logNewWeave(friends, data, database);

      // 3. Record chip usage for adaptive suggestions (if reflection chips exist)
      if (data.reflection?.chips && data.reflection.chips.length > 0) {
        const friendId = friends.length === 1 ? friends[0].id : undefined;
        await recordReflectionChips(data.reflection.chips, interactionId, friendId).catch(error => {
          console.error('[InteractionStore] Failed to record chip usage for interaction', interactionId, error);
          // Non-blocking: chip tracking is supplementary, don't fail the interaction
          // TODO: Consider adding a retry queue or showing a warning toast to user
        });
      }

      // 4. Record practice (updates streak) and check for milestone unlocks
      const newMilestoneIds = await recordPractice('log_weave', interactionId);

      // 5. If a new milestone was unlocked, show celebration
      if (newMilestoneIds.length > 0) {
        const milestone = CONSISTENCY_MILESTONES.find(m => m.id === newMilestoneIds[0]);
        if (milestone) {
          useUIStore.getState().showMilestoneCelebration(milestone);
        }
      }

      // 6. If reflection data exists, record it for depth tracking
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

      // 7. Queue badge and achievement unlock celebrations
      // Badge unlocks are shown first, then achievements
      if (badgeUnlocks.length > 0) {
        useUIStore.getState().queueBadgeUnlocks(badgeUnlocks);
      }
      if (achievementUnlocks.length > 0) {
        useUIStore.getState().queueAchievementUnlocks(achievementUnlocks);
      }

      // 8. Analyze notes/reflections for life events and auto-tag
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

    // Record chip usage for adaptive suggestions
    if (reflection.chips && reflection.chips.length > 0) {
      // Get friend ID from interaction
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interactionId))
        .fetch();

      const friendId = interactionFriends.length === 1 ? interactionFriends[0].friendId : undefined;
      await recordReflectionChips(reflection.chips, interactionId, friendId).catch(error => {
        console.error('[InteractionStore] Failed to record chip usage while updating reflection', interactionId, error);
        // Non-blocking: chip tracking is supplementary
      });
    }
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

    // Record chip usage if reflection was updated
    if (updates.reflection?.chips && updates.reflection.chips.length > 0) {
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interactionId))
        .fetch();

      const friendId = interactionFriends.length === 1 ? interactionFriends[0].friendId : undefined;
      await recordReflectionChips(updates.reflection.chips, interactionId, friendId).catch(error => {
        console.error('[InteractionStore] Failed to record chip usage while updating interaction', interactionId, error);
        // Non-blocking: chip tracking is supplementary
      });
    }

    // Update calendar event if this is a planned interaction with a calendar event
    if (calendarEventId && isPlanned) {
      const calendarUpdates: CalendarEventUpdate = {};

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
  syncWithCalendar: async (): Promise<CalendarSyncResult | null> => {
    const state = get();
    if (state.isSyncing) {
      console.log('[InteractionStore] Sync already in progress, skipping');
      return null;
    }

    set({ isSyncing: true });

    try {
      const result = await syncCalendarChanges();
      set({ lastSyncTime: new Date(), isSyncing: false });

      // Show toast notification if there were changes
      if (result.changes.length > 0) {
        const syncedCount = result.synced;
        const deletedCount = result.deleted;

        let message = '';
        if (syncedCount > 0 && deletedCount > 0) {
          message = `Synced ${syncedCount} change${syncedCount === 1 ? '' : 's'} and ${deletedCount} deleted event${deletedCount === 1 ? '' : 's'}`;
        } else if (syncedCount > 0) {
          message = `Synced ${syncedCount} change${syncedCount === 1 ? '' : 's'}`;
        } else if (deletedCount > 0) {
          message = `${deletedCount} plan${deletedCount === 1 ? '' : 's'} cancelled`;
        }

        if (message) {
          console.log('[InteractionStore] Calendar sync:', message);
          // Show toast notification to user
          useUIStore.getState().showToast(message, 'Calendar');
        }
      }

      return result;
    } catch (error) {
      console.error('[InteractionStore] Error syncing calendar:', error);
      set({ isSyncing: false });
      return null;
    }
  },
}));
