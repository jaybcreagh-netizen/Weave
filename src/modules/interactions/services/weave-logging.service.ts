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
import { recalculateScoreOnDelete } from '@/modules/intelligence';
import { writeScheduler } from '@/shared/services/write-scheduler';

export async function logWeave(data: InteractionFormData): Promise<Interaction> {
    const logStart = Date.now();
    console.log(`[logWeave] START at ${logStart}`);

    // Validate input data
    try {
        WeaveLogSchema.parse(data);
    } catch (error) {
        throw new Error(`Invalid weave data: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`[logWeave] Validation done at ${Date.now() - logStart}ms`);

    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();
    console.log(`[logWeave] Friend fetch done at ${Date.now() - logStart}ms`);

    if (friends.length === 0) {
        throw new Error('No friends found for this interaction.');
    }

    // 1. Create the interaction record (Main Transaction - CRITICAL PRIORITY)
    const { interaction } = await writeScheduler.critical('logWeave', async () => {
        const batchOps: any[] = []; // keeping any[] for flexibility with WatermelonDB batch which sometimes requires specific Model types
        const batchStart = Date.now();

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
        console.log(`[logWeave:batch] prepareCreate interaction: ${Date.now() - batchStart}ms`);

        for (const friend of friends) {
            batchOps.push(database.get('interaction_friends').prepareCreate((_ifriend: any) => {
                const ifriend = _ifriend as InteractionFriend;
                ifriend.interaction.set(newInteraction);
                ifriend.friend.set(friend);
            }));
        }
        console.log(`[logWeave:batch] prepareCreate joins (${friends.length}): ${Date.now() - batchStart}ms`);

        const dbBatchStart = Date.now();
        await database.batch(batchOps);
        console.log(`[logWeave:batch] database.batch() itself: ${Date.now() - dbBatchStart}ms`);

        return { interaction: newInteraction };
    });
    console.log(`[logWeave] DB write done at ${Date.now() - logStart}ms`);

    // 2. Run Side Effects (Decoupled via Event Bus)
    // OPTIMIZATION: Fire-and-forget - the interaction is saved, scoring/gamification can run in background
    // This gives immediate UI feedback to the user
    eventBus.emit('interaction:created', {
        interactionId: interaction.id,
        friends,
        data
    }).catch(error => {
        Logger.error('[WeaveLogging] Background: Error in event handlers:', error);
    });

    // Analytics - quick and non-blocking
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
    console.log(`[logWeave] COMPLETE at ${Date.now() - logStart}ms`);

    return interaction;
}

export async function planWeave(data: InteractionFormData, options?: { skipToast?: boolean }): Promise<Interaction> {
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length === 0) {
        throw new Error('No friends found for this plan.');
    }

    // IMPORTANT PRIORITY: User action but slight delay acceptable
    const interaction = await writeScheduler.important('planWeave', async () => {
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

        // Show confirmation toast
        if (!options?.skipToast) {
            import('@/shared/stores/uiStore').then(({ useUIStore }) => {
                const friendNames = friends.map(f => f.name);
                let message = 'Weave planned!';
                if (friendNames.length === 1) {
                    message = `Planned with ${friendNames[0]}!`;
                } else if (friendNames.length > 1) {
                    message = `Planned with ${friendNames[0]} + ${friendNames.length - 1} others!`;
                }
                useUIStore.getState().showToast(message, friendNames[0] || '');
            }).catch(err => Logger.error('Error triggering toast:', err));
        }

        return newInteraction;
    });

    return interaction;
}

export async function deleteWeave(id: string): Promise<void> {
    const interaction = await database.get('interactions').find(id) as Interaction;
    const calendarEventId = interaction.calendarEventId;

    // CRITICAL PRIORITY: User-initiated delete action
    await writeScheduler.critical('deleteWeave', async () => {
        const joinRecords = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', id)).fetch();

        // RECALCULATE SCORING before deleting
        const friendIds = joinRecords.map(r => r.friendId);
        if (friendIds.length > 0 && interaction.status === 'completed') {
            const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();
            await recalculateScoreOnDelete(interaction, friends, database);
        }

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

    // Emit deletion event so other modules (like notifications) can clean up
    eventBus.emit('interaction:deleted', { interactionId: id });
}
