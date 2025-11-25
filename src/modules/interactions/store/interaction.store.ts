import { create } from 'zustand';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { Subscription } from 'rxjs';
import Interaction from '@/db/models/Interaction';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import { InteractionFormData, StructuredReflection } from '../types';
import * as WeaveLoggingService from '../services/weave-logging.service';
import * as PlanService from '../services/plan.service';
import * as CalendarService from '../services/calendar.service';
import { InteractionCategory, Vibe } from '@/shared/types/common';

// --- State and Store Definition ---

interface InteractionsStore {
    interactions: Interaction[];
    intentions: Intention[];
    isLoading: boolean;
    observeInteractions: () => void;
    unobserveInteractions: () => void;
    observeIntentions: () => void;
    unobserveIntentions: () => void;

    // Interaction Actions (calling services)
    logWeave: (data: InteractionFormData) => Promise<Interaction>;
    planWeave: (data: InteractionFormData) => Promise<Interaction>;
    deleteWeave: (id: string) => Promise<void>;

    // Plan Actions (calling services)
    completePlan: (id: string) => Promise<void>;
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

export const useInteractionsStore = create<InteractionsStore>((set, get) => ({
    interactions: [],
    intentions: [],
    isLoading: true,

    observeInteractions: () => {
        if (interactionSubscription) return;
        set({ isLoading: true });
        interactionSubscription = database.get<Interaction>('interactions')
            .query(Q.sortBy('interaction_date', Q.desc))
            .observe()
            .subscribe(interactions => {
                set({ interactions, isLoading: false });
            });
    },

    unobserveInteractions: () => {
        interactionSubscription?.unsubscribe();
        interactionSubscription = null;
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
    completePlan: async (id) => PlanService.completePlan(id),
    cancelPlan: async (id) => PlanService.cancelPlan(id),
    syncCalendar: async () => CalendarService.syncCalendarChanges(),

    updateInteraction: async (interactionId, updates) => {
        await database.write(async () => {
            const interaction = await database.get<Interaction>('interactions').find(interactionId);
            await interaction.update(i => {
                Object.assign(i, updates);
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
        get().updateInteraction(interactionId, { vibe, note: notes });
    },

    createIntention: async (friendIds, description, category) => {
        await database.write(async () => {
            const intention = await database.get<Intention>('intentions').create(i => {
                i.description = description;
                i.interactionCategory = category;
                i.status = 'active';
            });

            for (const friendId of friendIds) {
                await database.get<IntentionFriend>('intention_friends').create(ifriend => {
                    ifriend.intention.set(intention);
                    ifriend.friendId = friendId;
                });
            }
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
