import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { processWeaveScoring } from '@/modules/intelligence';
import { checkFriendBadges, checkGlobalAchievements, recordMilestone } from '@/modules/gamification';
import { InteractionFormData } from '../types';
import { WeaveLogSchema } from '@/shared/types/validators';

// TODO: These should be moved to the insights module
import { trackEvent, AnalyticsEvents, updateLastInteractionTimestamp } from '@/shared/services/analytics.service';
import { analyzeAndTagLifeEvents } from '@/modules/relationships';
import { deleteWeaveCalendarEvent } from './calendar.service';

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

    const { interaction } = await database.write(async () => {
        const newInteraction = await database.get<Interaction>('interactions').create(interaction => {
            interaction.interactionDate = data.date;
            interaction.interactionType = 'log';
            interaction.status = 'completed';
            interaction.activity = data.activity;
            interaction.mode = data.mode;
            interaction.note = data.notes;
            interaction.vibe = data.vibe;
            interaction.duration = data.duration;
            if (data.category) {
                interaction.interactionCategory = data.category;
            }
            if (data.reflection) {
                interaction.reflectionJSON = JSON.stringify(data.reflection);
            }
        });

        for (const friend of friends) {
            await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
                ifriend.interaction.set(newInteraction);
                ifriend.friend.set(friend);
            });
        }

        await processWeaveScoring(friends, data);

        for (const friend of friends) {
            await checkFriendBadges(friend.id);
        }

        await checkGlobalAchievements();

        trackEvent(AnalyticsEvents.INTERACTION_LOGGED, {
            activity: data.activity,
            category: data.category,
            duration: data.duration,
            vibe: data.vibe,
            friends_count: friends.length,
            has_notes: !!data.notes,
            has_reflection: !!data.reflection,
        });
        updateLastInteractionTimestamp();

        // TODO: Move this to the gamification module
        await recordMilestone('log_weave');

        // TODO: Move this to the insights module
        if (data.notes && data.notes.trim().length > 0) {
            for (const friend of friends) {
                analyzeAndTagLifeEvents(friend.id, data.notes, data.date).catch(error => {
                    console.error('Error analyzing life events:', error);
                });
            }
        }

        return { interaction: newInteraction };
    });

    return interaction;
}

export async function planWeave(data: InteractionFormData): Promise<Interaction> {
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(data.friendIds))).fetch();

    if (friends.length === 0) {
        throw new Error('No friends found for this plan.');
    }

    const interaction = await database.write(async () => {
        const newInteraction = await database.get<Interaction>('interactions').create(interaction => {
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
        });

        for (const friend of friends) {
            await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
                ifriend.interaction.set(newInteraction);
                ifriend.friend.set(friend);
            });
        }

        trackEvent(AnalyticsEvents.INTERACTION_PLANNED, {
            activity: data.activity,
            category: data.category,
            friends_count: friends.length,
        });

        return newInteraction;
    });

    return interaction;
}

export async function deleteWeave(id: string): Promise<void> {
    const interaction = await database.get<Interaction>('interactions').find(id);
    const calendarEventId = interaction.calendarEventId;

    await database.write(async () => {
        const joinRecords = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', id)).fetch();
        const recordsToDelete = joinRecords.map(r => r.prepareDestroyPermanently());
        await database.batch(...recordsToDelete, interaction.prepareDestroyPermanently());
    });

    if (calendarEventId) {
        // We're not awaiting this, as it can happen in the background
        deleteWeaveCalendarEvent(calendarEventId).catch(err => {
            console.warn('Failed to delete calendar event:', err);
        });
    }
}
