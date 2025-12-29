import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { InteractionFormData, StructuredReflection } from '../types';
import * as CalendarService from './calendar.service';
import { InteractionCategory, Vibe, Duration } from '@/shared/types/common';
import { recalculateScoreOnDelete, processWeaveScoring, recalculateScoreOnEdit } from '@/modules/intelligence';

export const InteractionActions = {
    updateInteraction: async (interactionId: string, updates: Partial<Interaction> & { friendIds?: string[] }): Promise<void> => {
        // 1. Fetch current interaction state
        const interaction = await database.get<Interaction>('interactions').find(interactionId);

        // Handle Participant Changes
        // Check if friendIds are provided in updates (from EditInteractionModal)
        // friendIds is not on Interaction model but passed in updates for this specific flow
        const newFriendIds: string[] | undefined = updates.friendIds;

        let addedFriendIds: string[] = [];
        let removedFriendIds: string[] = [];

        if (newFriendIds) {
            const currentJoinRecords = await interaction.interactionFriends.fetch();
            const currentFriendIds = currentJoinRecords.map(r => r.friendId);

            const addedIds = newFriendIds.filter(id => !currentFriendIds.includes(id));
            addedFriendIds = addedIds;
            const removedIds = currentFriendIds.filter(id => !newFriendIds.includes(id));
            removedFriendIds = removedIds;

            if (removedIds.length > 0) {
                const removedFriends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(removedIds))).fetch();
                // Revert score for removed friends
                await recalculateScoreOnDelete(interaction, removedFriends, database);

                // Delete join records
                await database.write(async () => {
                    const recordsToDelete = currentJoinRecords.filter(r => removedIds.includes(r.friendId));
                    if (recordsToDelete.length > 0) {
                        const ops = recordsToDelete.map(r => r.prepareDestroyPermanently());
                        await database.batch(...ops);
                    }
                });
            }

            if (addedIds.length > 0) {
                const addedFriends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(addedIds))).fetch();

                // Construct data object for scoring
                const interactionData: InteractionFormData = {
                    friendIds: [], // Not used for individual adding
                    category: (updates.interactionCategory || interaction.interactionCategory) as InteractionCategory,
                    activity: updates.activity || interaction.activity,
                    date: updates.interactionDate || interaction.interactionDate,
                    type: 'log',
                    status: 'completed',
                    mode: interaction.mode,
                    vibe: (updates.vibe || interaction.vibe) as Vibe | null,
                    duration: (updates.duration || interaction.duration) as Duration | null,
                    notes: updates.note || interaction.note,
                    reflection: interaction.reflectionJSON ? JSON.parse(interaction.reflectionJSON) : undefined,
                };

                // Create join records first
                await database.write(async () => {
                    const batchOps: any[] = [];
                    for (const friend of addedFriends) {
                        batchOps.push(database.get('interaction_friends').prepareCreate((_ifriend: any) => {
                            const ifriend = _ifriend as InteractionFriend;
                            ifriend.interaction.set(interaction);
                            ifriend.friend.set(friend);
                        }));
                    }
                    await database.batch(batchOps);
                });

                // processWeaveScoring for added friends
                await processWeaveScoring(addedFriends, interactionData, database);
            }

            // Remove friendIds from updates before applying to Interaction model
            // @ts-ignore
            delete updates.friendIds;
        }

        // 2. Check if score-affecting fields are changing (Apply to REMAINING friends)
        const isScoreUpdateNeeded =
            interaction.status === 'completed' && (
                (updates.interactionCategory && updates.interactionCategory !== interaction.interactionCategory) ||
                (updates.activity && updates.activity !== interaction.activity) ||
                (updates.vibe && updates.vibe !== interaction.vibe) ||
                (updates.duration && updates.duration !== interaction.duration) ||
                (updates.note && updates.note !== interaction.note) ||
                (updates.reflectionJSON && updates.reflectionJSON !== interaction.reflectionJSON)
            );

        if (isScoreUpdateNeeded) {
            // Prepare data objects for recalculation
            const oldData: InteractionFormData = {
                friendIds: [],
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

            // Fetch associated friends for score recalculation
            const interactionFriends = await interaction.interactionFriends.fetch();

            // Recalculate scores in parallel for remaining friends (SKIP added/removed)
            const recalcPromises = interactionFriends
                .filter((iFriend: InteractionFriend) =>
                    !addedFriendIds.includes(iFriend.friendId) &&
                    !removedFriendIds.includes(iFriend.friendId)
                )
                .map((iFriend: InteractionFriend) => recalculateScoreOnEdit(iFriend.friendId, oldData, newData, database));

            await Promise.all(recalcPromises);
        }

        // 3. Update Interaction Record
        if (Object.keys(updates).length > 0) {
            await database.write(async () => {
                await interaction.update(rec => {
                    if (updates.interactionCategory) rec.interactionCategory = updates.interactionCategory;
                    if (updates.activity) rec.activity = updates.activity;
                    // handle nulls/undefined for optional fields
                    if (updates.vibe !== undefined) rec.vibe = updates.vibe;
                    if (updates.duration !== undefined) rec.duration = updates.duration;
                    if (updates.note !== undefined) rec.note = updates.note;
                    if (updates.reflectionJSON) rec.reflectionJSON = updates.reflectionJSON;
                    if (updates.interactionDate) rec.interactionDate = updates.interactionDate;
                    if (updates.title !== undefined) rec.title = updates.title;
                    if (updates.location !== undefined) rec.location = updates.location;
                });
            });
        }

        // 4. Sync Calendar Event (for planned interactions with calendar events)
        if (interaction.calendarEventId && interaction.status === 'planned') {
            const calendarUpdates: { title?: string; date?: Date; location?: string; notes?: string } = {};

            if (updates.interactionDate) {
                calendarUpdates.date = updates.interactionDate;
            }
            if (updates.title !== undefined) {
                calendarUpdates.title = updates.title || undefined;
            }
            if (updates.location !== undefined) {
                calendarUpdates.location = updates.location || undefined;
            }
            if (updates.note !== undefined) {
                calendarUpdates.notes = updates.note || undefined;
            }

            if (Object.keys(calendarUpdates).length > 0) {
                CalendarService.updateWeaveCalendarEvent(interaction.calendarEventId, calendarUpdates)
                    .catch(err => console.warn('Failed to update calendar event:', err));
            }
        }

        // 5. Trigger Shared Weave Sync (Phase 4)
        try {
            // Check if linked to a shared weave
            // We use raw query to avoid importing the Model class if not strictly needed, 
            // but importing the Model is cleaner. I'll stick to dynamic import for the Service.
            // But for Model, let's assume I added the import at the top.
            // Actually, I can use string table name safely.
            const sharedRefs = await database.get('shared_weave_refs')
                .query(Q.where('interaction_id', interactionId))
                .fetch();

            if (sharedRefs.length > 0) {
                const syncPayload: any = { interactionId };
                let shouldSync = false;

                if (updates.title !== undefined) { syncPayload.title = updates.title; shouldSync = true; }
                if (updates.note !== undefined) { syncPayload.note = updates.note; shouldSync = true; }
                if (updates.location !== undefined) { syncPayload.location = updates.location; shouldSync = true; }
                if (updates.interactionDate) { syncPayload.weaveDate = updates.interactionDate.toISOString(); shouldSync = true; }
                if (updates.activity) { syncPayload.category = updates.activity; shouldSync = true; } // Map activity to category if needed
                if (updates.duration) { syncPayload.duration = updates.duration; shouldSync = true; }


                if (shouldSync) {
                    const { enqueueOperation } = await import('@/modules/sync/services/action-queue.service');
                    await enqueueOperation('update_shared_weave', syncPayload);
                }
            }
        } catch (err) {
            console.warn('Failed to trigger shared weave sync:', err);
        }
    },

    updateReflection: async (interactionId: string, reflection: StructuredReflection): Promise<void> => {
        await InteractionActions.updateInteraction(interactionId, { reflectionJSON: JSON.stringify(reflection) });
    },

    updateInteractionCategory: async (interactionId: string, category: InteractionCategory): Promise<void> => {
        await InteractionActions.updateInteraction(interactionId, { interactionCategory: category, activity: category });
    },

    updateInteractionVibeAndNotes: async (interactionId: string, vibe: Vibe | null, notes?: string): Promise<void> => {
        const updates: Partial<Interaction> = { vibe: vibe || undefined, note: notes };
        // Also set reflectionJSON so that FocusPlanItem can detect the reflection
        if (vibe || notes) {
            updates.reflectionJSON = JSON.stringify({
                vibe,
                notes,
                timestamp: Date.now()
            });
        }
        await InteractionActions.updateInteraction(interactionId, updates);
    },

    createIntention: async (friendIds: string[], description?: string, category?: InteractionCategory): Promise<void> => {
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

    dismissIntention: async (intentionId: string): Promise<void> => {
        await database.write(async () => {
            const intention = await database.get<Intention>('intentions').find(intentionId);
            await intention.update(i => { i.status = 'dismissed' });
        });
    },

    getActiveIntentions: async (): Promise<Intention[]> => {
        return database.get<Intention>('intentions').query(Q.where('status', 'active')).fetch();
    }
};
