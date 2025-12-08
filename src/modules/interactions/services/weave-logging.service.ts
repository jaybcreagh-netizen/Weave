import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { processWeaveScoring } from '@/modules/intelligence/services/orchestrator.service';
import { checkAndAwardFriendBadges } from '@/modules/gamification/services/badge.service';
import { checkAndAwardGlobalAchievements } from '@/modules/gamification/services/achievement.service';
import { recordPractice } from '@/modules/gamification/services/milestone-tracker.service';
import { InteractionFormData } from '../types';
import { WeaveLogSchema } from '@/shared/types/validators';

// TODO: These should be moved to the insights module
import { trackEvent, AnalyticsEvents, updateLastInteractionTimestamp } from '@/shared/services/analytics.service';
import { analyzeAndTagLifeEvents } from '@/modules/relationships/services/life-event-detection';
import { deleteWeaveCalendarEvent } from './calendar.service';
import { checkTierSuggestionAfterInteraction } from '@/modules/insights/services/tier-suggestion-engine.service';
import { analyzeTierFit } from '@/modules/insights/services/tier-fit.service';
import { updateTierFit } from '@/modules/insights/services/tier-management.service';
import Logger from '@/shared/utils/Logger';

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

    // 2. Run Side Effects (Sequential, outside main transaction to avoid deadlocks)
    try {
        // Scoring
        await processWeaveScoring(friends, data, database);

        // Badges & Achievements
        for (const friend of friends) {
            await checkAndAwardFriendBadges(friend.id, friend.name);
        }

        await checkAndAwardGlobalAchievements();

        // Analytics
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

        // Gamification
        await recordPractice('log_weave', interaction.id);

        // Insights (Life Events)
        if (data.notes && data.notes.trim().length > 0) {
            for (const friend of friends) {
                try {
                    await analyzeAndTagLifeEvents(friend.id, data.notes, data.date);
                } catch (error) {
                    Logger.error('Error analyzing life events:', error);
                }
            }
        }

        // Tier Intelligence: Always analyze and persist patterns after interaction
        for (const friend of friends) {
            try {
                // Refetch friend to get updated ratedWeavesCount after scoring
                const updatedFriend = await database.get<FriendModel>('friends').find(friend.id);
                const wasFirstInteraction = updatedFriend.ratedWeavesCount === 1;

                // Skip tier analysis for first interaction - need at least 2 for patterns
                if (wasFirstInteraction) {
                    continue;
                }

                // Always run tier fit analysis to update cached interval data
                const analysis = await analyzeTierFit(updatedFriend);

                // Only persist if we have valid data (not insufficient_data)
                if (analysis.fitCategory !== 'insufficient_data' && analysis.actualIntervalDays > 0) {
                    await updateTierFit(
                        updatedFriend.id,
                        analysis.fitScore,
                        analysis.suggestedTier,
                        analysis.actualIntervalDays // Always persist the calculated interval
                    );

                    // Log suggestion if there's a mismatch at a milestone
                    if (analysis.suggestedTier) {
                        const suggestion = await checkTierSuggestionAfterInteraction(
                            updatedFriend.id,
                            wasFirstInteraction
                        );
                        if (suggestion) {
                            Logger.info(`[WeaveLogging] Tier suggestion for ${updatedFriend.name}: ${analysis.currentTier} → ${analysis.suggestedTier}`);
                        }
                    }
                }
            } catch (error) {
                Logger.error('Error updating tier patterns:', error);
            }
        }
    } catch (error) {
        Logger.error('Error running side effects for logWeave:', error);
        // We do NOT throw here, because the interaction was successfully created.
        // Failing side effects shouldn't block the user flow.
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
