import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { InteractionFormData } from '../types';
import { WeaveLogSchema } from '@/shared/types/validators';

// TODO: These should be moved to the insights module
import { trackEvent, AnalyticsEvents, updateLastInteractionTimestamp } from '@/shared/services/analytics.service';
import { deleteWeaveCalendarEvent } from './calendar.service';
import Logger from '@/shared/utils/Logger';
import { eventBus } from '@/shared/events/event-bus';

export async function logWeave(data: InteractionFormData): Promise<Interaction> {
    // Validate input data
    try {
        WeaveLogSchema.parse(data);
    } catch (error) {
        throw new Error(`Invalid weave data: ${error instanceof Error ? error.message : String(error)}`);
    }

    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length === 0) {
        throw new Error('No friends found for this interaction.');
    }

    // 1. Create the interaction record (Main Transaction)
    const { interaction } = await database.write(async () => {
        const batchOps: any[] = []; // keeping any[] for flexibility with WatermelonDB batch which sometimes requires specific Model types

        const newInteraction = database.get<Interaction>('interactions').prepareCreate((interaction: Interaction) => {
            interaction.interactionDate = data.date;
            interaction.interactionType = 'log';
            interaction.status = 'completed';
            interaction.activity = data.activity;
            interaction.mode = data.mode;
            interaction.note = data.notes;
            interaction.vibe = data.vibe || undefined;
            interaction.duration = data.duration || undefined;
            if (data.title) {
                interaction.title = data.title;
            }
            if (data.category) {
                interaction.interactionCategory = data.category;
            }
            if (data.reflection) {
                interaction.reflectionJSON = JSON.stringify(data.reflection);
            }
            if (data.initiator) {
                interaction.initiator = data.initiator;
            }
        });
        batchOps.push(newInteraction);

        for (const friend of friends) {
            batchOps.push(database.get('interaction_friends').prepareCreate((_ifriend: any) => {
                const ifriend = _ifriend as InteractionFriend;
                ifriend.interaction.set(newInteraction);
                ifriend.friend.set(friend);
            }));
        }

        await database.batch(batchOps);

        return { interaction: newInteraction };
    });


    // 2. Run Side Effects (Decoupled via Event Bus)
    // We emit the event and let subscribers handle scoring, gamification, analytics, etc.
    // This resolves circular dependencies.
    try {
        await eventBus.emit('interaction:created', {
            interactionId: interaction.id,
            friends,
            data
        });

        // Analytics - We keep this here as it's a cross-cutting concern often tied to the action itself,
        // but it could also be moved to a listener if desired. For now, we leave it to match the plan.
        trackEvent(AnalyticsEvents.INTERACTION_LOGGED, {
            activity: data.activity,
            category: data.category,
            duration: data.duration,
            vibe: data.vibe,
            friends_count: friends.length,
            has_notes: !!data.notes,
            has_reflection: !!data.reflection,
            initiator: data.initiator,
        });
        updateLastInteractionTimestamp();

    } catch (error) {
        Logger.error('Error emitting interaction event:', error);
        // We do NOT throw here, because the interaction was successfully created.
    }


    return interaction;
}

export async function planWeave(data: InteractionFormData): Promise<Interaction> {
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length === 0) {
        throw new Error('No friends found for this plan.');
    }

    const interaction = await database.write(async () => {
        const batchOps: any[] = [];

        // @ts-ignore
        const newInteraction = database.get<Interaction>('interactions').prepareCreate((interaction: Interaction) => {
            interaction.interactionDate = data.date;
            interaction.interactionType = 'plan';
            interaction.status = 'planned';
            interaction.activity = data.activity;
            interaction.mode = data.mode;
            interaction.note = data.notes;
            interaction.title = data.title;
            interaction.location = data.location;
            if (data.category) {
                interaction.interactionCategory = data.category;
            }
            if (data.initiator) {
                interaction.initiator = data.initiator;
            }
        });
        batchOps.push(newInteraction);

        for (const friend of friends) {
            batchOps.push(database.get('interaction_friends').prepareCreate((_ifriend: any) => {
                const ifriend = _ifriend as InteractionFriend;
                ifriend.interaction.set(newInteraction);
                ifriend.friend.set(friend);
            }));
        }

        await database.batch(batchOps);

        trackEvent(AnalyticsEvents.INTERACTION_PLANNED, {
            activity: data.activity,
            category: data.category,
            friends_count: friends.length,
        });

        // Trigger side effects (like notifications)
        eventBus.emit('interaction:created', {
            interactionId: newInteraction.id,
            friends,
            data
        }).catch(err => Logger.error('Error emitting interaction:created for plan:', err));

        return newInteraction;
    });

    return interaction;
}

export async function deleteWeave(id: string): Promise<void> {
    const interaction = await database.get('interactions').find(id) as Interaction;
    const calendarEventId = interaction.calendarEventId;

    await database.write(async () => {
        const joinRecords = await database.get('interaction_friends').query(Q.where('interaction_id', id)).fetch();
        const recordsToDelete = joinRecords.map(r => r.prepareDestroyPermanently());
        await database.batch(...recordsToDelete, interaction.prepareDestroyPermanently());
    });

    if (calendarEventId) {
        // We're not awaiting this, as it can happen in the background
        deleteWeaveCalendarEvent(calendarEventId).catch(err => {
            Logger.warn('Failed to delete calendar event:', err);
        });
    }

    trackEvent(AnalyticsEvents.INTERACTION_DELETED);
}
