import { create } from 'zustand';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { Subscription } from 'rxjs';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import { InteractionFormData, StructuredReflection } from '../types';
import * as WeaveLoggingService from '../services/weave-logging.service';
import * as PlanService from '../services/plan.service';
import * as CalendarService from '../services/calendar.service';
import { InteractionCategory, Vibe, Duration } from '@/shared/types/common';
import { recalculateScoreOnEdit } from '@/modules/intelligence';

// --- State and Store Definition ---

interface InteractionsStore {
    interactions: Interaction[];
    intentions: Intention[];
    isLoading: boolean;
    observeInteractions: () => void;
    unobserveInteractions: () => void;
    observeIntentions: () => void;
    unobserveIntentions: () => void;
    subscriberCount: number;

    // Interaction Actions (calling services)
    logWeave: (data: InteractionFormData) => Promise<Interaction>;
    planWeave: (data: InteractionFormData) => Promise<Interaction>;
    deleteWeave: (id: string) => Promise<void>;

    // Plan Actions (calling services)
    completePlan: (id: string, data?: { vibe?: string; note?: string }) => Promise<void>;
    cancelPlan: (id: string) => Promise<void>;

    // Calendar Actions (calling services)
    syncCalendar: () => Promise<CalendarService.CalendarSyncResult>;

    // Direct DB Updates (for granular changes)
    updateInteraction: (interactionId: string, updates: Partial<Interaction>) => Promise<void>;
    updateReflection: (interactionId: string, reflection: StructuredReflection) => Promise<void>;
    updateInteractionCategory: (interactionId: string, category: InteractionCategory) => Promise<void>;
    updateInteractionVibeAndNotes: (interactionId: string, vibe?: Vibe | null, notes?: string) => Promise<void>;

    // Intention Actions
    createIntention: (friendIds: string[], description?: string, category?: InteractionCategory) => Promise<void>;
    dismissIntention: (intentionId: string) => Promise<void>;
    getActiveIntentions: () => Promise<Intention[]>;
}

let interactionSubscription: Subscription | null = null;
let intentionSubscription: Subscription | null = null;
let isInitializing = false;

export const useInteractionsStore = create<InteractionsStore>((set, get) => ({
    interactions: [],
    intentions: [],
    isLoading: true,

    subscriberCount: 0,

    observeInteractions: () => {
        const currentCount = get().subscriberCount;
        set({ subscriberCount: currentCount + 1 });

        if (interactionSubscription || isInitializing) return;

        isInitializing = true;
        set({ isLoading: true });
        try {
            interactionSubscription = database.get<Interaction>('interactions')
                .query(Q.sortBy('interaction_date', Q.desc))
                .observe()
                .subscribe(interactions => {
                    set({ interactions, isLoading: false });
                });
        } finally {
            isInitializing = false;
        }
    },

    unobserveInteractions: () => {
        const currentCount = get().subscriberCount;
        const newCount = Math.max(0, currentCount - 1);
        set({ subscriberCount: newCount });

        if (newCount === 0) {
            interactionSubscription?.unsubscribe();
            interactionSubscription = null;
        }
    },

    observeIntentions: () => {
        if (intentionSubscription) return;
        intentionSubscription = database.get<Intention>('intentions')
            .query(Q.where('status', 'active'))
            .observe()
            .subscribe(intentions => {
                set({ intentions });
            });
    },

    unobserveIntentions: () => {
        intentionSubscription?.unsubscribe();
        intentionSubscription = null;
    },

    logWeave: async (data) => WeaveLoggingService.logWeave(data),
    planWeave: async (data) => WeaveLoggingService.planWeave(data),
    deleteWeave: async (id) => WeaveLoggingService.deleteWeave(id),
    completePlan: async (id, data) => PlanService.completePlan(id, data),
    cancelPlan: async (id) => PlanService.cancelPlan(id),
    syncCalendar: async () => CalendarService.syncCalendarChanges(),

    updateInteraction: async (interactionId, updates) => {
        // 1. Fetch current interaction state (before update)
        const interaction = await database.get<Interaction>('interactions').find(interactionId);

        // 2. Check if score-affecting fields are changing
        const isScoreUpdateNeeded =
            interaction.status === 'completed' && (
                (updates.interactionCategory && updates.interactionCategory !== interaction.interactionCategory) ||
                (updates.activity && updates.activity !== interaction.activity) ||
                (updates.vibe && updates.vibe !== interaction.vibe) ||
                (updates.duration && updates.duration !== interaction.duration) ||
                (updates.note && updates.note !== interaction.note) || // Notes affect quality
                (updates.reflectionJSON && updates.reflectionJSON !== interaction.reflectionJSON)
            );

        if (isScoreUpdateNeeded) {
            // Prepare data objects for recalculation
            const oldData: InteractionFormData = {
                friendIds: [], // Not needed for point calc
                category: interaction.interactionCategory as InteractionCategory,
                activity: interaction.activity,
                date: interaction.interactionDate,
                type: 'log',
                status: 'completed',
                mode: interaction.mode,
                vibe: interaction.vibe as Vibe | null,
                duration: interaction.duration as Duration | null,
                notes: interaction.note,
                reflection: interaction.reflectionJSON ? JSON.parse(interaction.reflectionJSON) : undefined,
            };

            const newData: InteractionFormData = {
                ...oldData,
                category: (updates.interactionCategory || updates.activity || oldData.category) as InteractionCategory,
                activity: updates.activity || oldData.activity,
                vibe: (updates.vibe !== undefined ? updates.vibe : oldData.vibe) as Vibe | null,
                duration: (updates.duration !== undefined ? updates.duration : oldData.duration) as Duration | null,
                notes: updates.note !== undefined ? updates.note : oldData.notes,
                reflection: updates.reflectionJSON ? JSON.parse(updates.reflectionJSON) : oldData.reflection,
            };

            // Fetch associated friends
            const interactionFriends = await interaction.interactionFriends.fetch();

            // Recalculate for each friend
            for (const iFriend of interactionFriends) {
                await recalculateScoreOnEdit(iFriend.friendId, oldData, newData, database);
            }
        }

        // 3. Perform the actual update
        await database.write(async () => {
            await interaction.update(i => {
                Object.assign(i, { ...updates, updatedAt: new Date() });
            });
        });
    },

    updateReflection: async (interactionId, reflection) => {
        get().updateInteraction(interactionId, { reflectionJSON: JSON.stringify(reflection) });
    },

    updateInteractionCategory: async (interactionId, category) => {
        get().updateInteraction(interactionId, { interactionCategory: category, activity: category });
    },

    updateInteractionVibeAndNotes: async (interactionId, vibe, notes) => {
        get().updateInteraction(interactionId, { vibe: vibe || undefined, note: notes });
    },

    createIntention: async (friendIds, description, category) => {
        // Fetch friends first to ensure they exist and to set relations correctly
        const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();

        if (friends.length === 0) {
            console.error('[createIntention] No friends found for intention');
            return;
        }

        await database.write(async () => {
            const batchOps: any[] = [];

            const intention = database.get<Intention>('intentions').prepareCreate(i => {
                i.description = description;
                i.interactionCategory = category;
                i.status = 'active';
            });
            batchOps.push(intention);

            for (const friend of friends) {
                const intentionFriend = database.get<IntentionFriend>('intention_friends').prepareCreate(ifriend => {
                    ifriend.intention.set(intention);
                    ifriend.friend.set(friend);
                });
                batchOps.push(intentionFriend);
            }

            await database.batch(batchOps);
        });
    },

    dismissIntention: async (intentionId) => {
        await database.write(async () => {
            const intention = await database.get<Intention>('intentions').find(intentionId);
            await intention.update(i => { i.status = 'dismissed' });
        });
    },

    getActiveIntentions: async () => {
        return database.get<Intention>('intentions').query(Q.where('status', 'active')).fetch();
    }
}));
