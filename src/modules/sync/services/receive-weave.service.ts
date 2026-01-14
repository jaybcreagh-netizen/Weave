/**
 * Receive Weave Service
 * 
 * Handles accepting and declining incoming shared weaves.
 */

import { database } from '@/db';
import * as CalendarService from '@/modules/interactions/services/calendar.service';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type InteractionCategory } from '@/shared/types/legacy-types';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import Friend from '@/db/models/Friend';
import { enqueueOperation } from './action-queue.service';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import { Q } from '@nozbe/watermelondb';

export interface IncomingWeaveUpdate {
    id: string; // server shared_weave_id
    title?: string;
    weave_date?: string;
    location?: string;
    category?: string;
    duration?: string;
    note?: string;
    last_edited_by?: string;
}

interface IncomingWeave {
    id: string; // server shared_weave_id
    creatorUserId: string;
    creatorName: string;
    creatorAvatarUrl?: string;
    weaveDate: string; // ISO string
    title?: string;
    location?: string;
    category: string;
    duration?: string;
}

/**
 * Accept an incoming shared weave
 * Creates a local interaction and SharedWeaveRef
 */
export async function acceptWeave(sharedWeaveId: string, weaveData: IncomingWeave): Promise<string> {
    try {
        const client = getSupabaseClient();
        if (!client) throw new Error('No Supabase client');

        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // SMART FRIEND MATCHING
        const friendsCollection = database.get<Friend>('friends');

        // 1. Try to find by linked user ID (Direct Match)
        const linkedFriends = await friendsCollection
            .query(Q.where('linked_user_id', weaveData.creatorUserId))
            .fetch();

        let creatorFriend = linkedFriends.length > 0 ? linkedFriends[0] : null;

        // 2. If no direct link, try fuzzy name matching on unlinked friends
        if (!creatorFriend) {
            const normalizedName = weaveData.creatorName.trim().toLowerCase();

            // Fetch all unlinked friends (linked_user_id is null)
            // We fetch all because we need to do fuzzy/normalized matching in JS
            // (WatermelonDB LIKE is case-sensitive on some adapters and we want robust trimming)
            const unlinkedFriends = await friendsCollection
                .query(Q.where('linked_user_id', null))
                .fetch();

            const match = unlinkedFriends.find(f => f.name.trim().toLowerCase() === normalizedName);

            if (match) {
                // MATCH FOUND: Merge profiles
                logger.info('ReceiveWeave', `Smart Match: Merging "${match.name}" with incoming weaver "${weaveData.creatorName}"`);

                await database.write(async () => {
                    await match.update(f => {
                        f.linkedUserId = weaveData.creatorUserId;
                        f.linkStatus = 'linked';
                        // We don't overwrite the name to preserve user's nickname preference
                    });
                });

                creatorFriend = match;
            } else {
                // NO MATCH: Create new friend
                logger.info('ReceiveWeave', `No match found. Creating new friend: "${weaveData.creatorName}"`);

                await database.write(async () => {
                    creatorFriend = await friendsCollection.create(record => {
                        record.name = weaveData.creatorName;
                        record.linkedUserId = weaveData.creatorUserId;
                        record.dunbarTier = 'Community'; // Default to outer circle
                        record.linkStatus = 'linked';
                        record.archetype = 'Fool'; // Default archetype
                    });
                });
            }
        }



        const isFuture = new Date(weaveData.weaveDate).getTime() > Date.now();
        let interactionId = '';

        await database.write(async () => {
            // Create local interaction
            const interactionsCollection = database.get<Interaction>('interactions');
            const interaction = await interactionsCollection.create(record => {
                record.interactionDate = new Date(weaveData.weaveDate);
                record.interactionType = 'log'; // Will be updated below based on isFuture
                // Logic check: if weaveDate > now, it should be 'plan' and status 'planned'

                record.interactionType = isFuture ? 'plan' : 'log';
                record.status = isFuture ? 'planned' : 'completed';

                record.interactionCategory = weaveData.category;
                record.activity = weaveData.category;
                record.title = weaveData.title;
                record.location = weaveData.location;
                record.duration = weaveData.duration;
                record.mode = 'one-on-one';
            });

            interactionId = interaction.id;

            // Link to creator friend
            if (creatorFriend) {
                const joinCollection = database.get<InteractionFriend>('interaction_friends');
                await joinCollection.create(record => {
                    record.interactionId = interaction.id;
                    record.friendId = creatorFriend!.id;
                });
            }

            // Create SharedWeaveRef
            const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
            await refCollection.create(ref => {
                ref.interactionId = interaction.id;
                ref.serverWeaveId = sharedWeaveId;
                ref.createdByUserId = weaveData.creatorUserId;
                ref.isCreator = false;
                ref.status = 'accepted';
                ref.sharedAt = Date.now();
                ref.respondedAt = Date.now();
            });
        });


        // CALENDAR INTEGRATION
        // Mirroring PlanWizard behavior: if it's a future plan, try to add to device calendar
        if (isFuture) {
            try {
                const settings = await CalendarService.getCalendarSettings();
                if (settings.enabled) {
                    const categoryMeta = getCategoryMetadata(weaveData.category as InteractionCategory);
                    const friendName = creatorFriend?.name || weaveData.creatorName;

                    const eventTitle = weaveData.title?.trim() ||
                        `🧵 ${categoryMeta?.label || weaveData.category} with ${friendName}`;

                    const result = await CalendarService.createWeaveCalendarEventWithResult({
                        title: eventTitle,
                        friendNames: friendName,
                        category: categoryMeta?.label || weaveData.category,
                        date: new Date(weaveData.weaveDate),
                        location: weaveData.location?.trim(),
                        notes: `Shared weave accepted from ${friendName}`,
                    });

                    if (result.success && result.eventId && interactionId) {
                        logger.info('ReceiveWeave', 'Created calendar event', { eventId: result.eventId });

                        // Update interaction with calendar event ID
                        await database.write(async () => {
                            const interaction = await database.get<Interaction>('interactions').find(interactionId);
                            await interaction.update(i => {
                                i.calendarEventId = result.eventId!;
                            });
                        });
                    }
                }
            } catch (calendarError) {
                logger.warn('ReceiveWeave', 'Failed to create calendar event:', calendarError);
                // Non-blocking, continue
            }
        }

        // Enqueue sync operation to update server
        await enqueueOperation('accept_weave', {
            sharedWeaveId,
            localInteractionId: interactionId,
        });

        logger.info('ReceiveWeave', 'Accepted shared weave', { sharedWeaveId, interactionId });

        return interactionId;

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to accept weave:', error);
        throw error;
    }
}

/**
 * Decline an incoming shared weave
 */
export async function declineWeave(sharedWeaveId: string): Promise<void> {
    try {
        const client = getSupabaseClient();
        if (!client) throw new Error('No Supabase client');

        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create a declined SharedWeaveRef to track that we declined
        const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');

        await database.write(async () => {
            await refCollection.create(ref => {
                ref.interactionId = ''; // No local interaction
                ref.serverWeaveId = sharedWeaveId;
                ref.createdByUserId = ''; // Unknown at this point
                ref.isCreator = false;
                ref.status = 'declined';
                ref.sharedAt = Date.now();
                ref.respondedAt = Date.now();
            });
        });

        // Enqueue sync operation
        await enqueueOperation('decline_weave', { sharedWeaveId });

        logger.info('ReceiveWeave', 'Declined shared weave', { sharedWeaveId });

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to decline weave:', error);
        throw error;
    }
}

/**
 * Handle update to a shared weave
 */
export async function handleSharedWeaveUpdate(update: IncomingWeaveUpdate): Promise<void> {
    try {
        // 1. Find local SharedWeaveRef
        const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
        const refs = await refCollection.query(Q.where('server_weave_id', update.id)).fetch();
        const ref = refs[0];

        if (!ref) {
            logger.debug('ReceiveWeave', 'Ignoring update for unknown weave', { id: update.id });
            return;
        }

        if (!ref.interactionId) {
            logger.debug('ReceiveWeave', 'Ignoring update for weave without interaction', { id: update.id });
            return;
        }

        // 2. Find local Interaction
        const interaction = await database.get<Interaction>('interactions').find(ref.interactionId);

        if (!interaction) {
            logger.warn('ReceiveWeave', 'Interaction not found for ref', { interactionId: ref.interactionId });
            return;
        }

        let changesMade = false;

        // 3. Apply updates to Interaction
        // We use a separate Write block for WatermelonDB
        await database.write(async () => {
            await interaction.update(rec => {
                if (update.title !== undefined && update.title !== rec.title) {
                    rec.title = update.title;
                    changesMade = true;
                }
                if (update.location !== undefined && update.location !== rec.location) {
                    rec.location = update.location;
                    changesMade = true;
                }
                if (update.category !== undefined && update.category !== rec.interactionCategory) {
                    rec.interactionCategory = update.category;
                    rec.activity = update.category; // Keep activity in sync
                    changesMade = true;
                }
                if (update.duration !== undefined && update.duration !== rec.duration) {
                    rec.duration = update.duration; // Cast if needed, assuming string matches
                    changesMade = true;
                }
                if (update.note !== undefined && update.note !== rec.note) {
                    rec.note = update.note;
                    changesMade = true;
                }
                if (update.weave_date !== undefined) {
                    const newDate = new Date(update.weave_date);
                    if (newDate.getTime() !== rec.interactionDate.getTime()) {
                        rec.interactionDate = newDate;
                        changesMade = true;
                    }
                }
            });

            // 4. Update SharedWeaveRef metadata if needed (not strictly persisted but good for debugging if we added columns)
            // But we don't have columns for last_edited on Ref. Ignoring for now.
        });

        if (changesMade) {
            logger.info('ReceiveWeave', 'Processed shared weave update', { weaveId: update.id });

            // 5. Update Calendar Event if exists
            if (interaction.calendarEventId) {
                const calendarUpdates: any = {};
                if (update.title) calendarUpdates.title = update.title;
                if (update.location) calendarUpdates.location = update.location;
                if (update.note) calendarUpdates.notes = update.note;
                if (update.weave_date) calendarUpdates.date = new Date(update.weave_date);

                if (Object.keys(calendarUpdates).length > 0) {
                    CalendarService.updateWeaveCalendarEvent(interaction.calendarEventId, calendarUpdates)
                        .catch(err => logger.warn('ReceiveWeave', 'Failed to update calendar for shared update', err));
                }
            }
        }

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to handle shared weave update:', error);
    }
}

/**
 * Fetch pending shared weaves from server
 */
export async function fetchPendingSharedWeaves(): Promise<IncomingWeave[]> {
    try {
        const client = getSupabaseClient();
        if (!client) return [];

        const { data: { user } } = await client.auth.getUser();
        if (!user) return [];

        // Get pending invitations for this user
        const { data: participants, error: participantError } = await client
            .from('shared_weave_participants')
            .select(`
                shared_weave_id,
                shared_weaves (
                    id,
                    created_by,
                    weave_date,
                    title,
                    location,
                    category,
                    duration
                )
            `)
            .eq('user_id', user.id)
            .eq('response', 'pending');

        if (participantError || !participants) {
            logger.error('ReceiveWeave', 'Failed to fetch pending weaves:', participantError);
            return [];
        }

        // Get creator names and avatars
        const creatorIds = [...new Set(participants.map((p: any) => p.shared_weaves?.created_by).filter(Boolean))];

        logger.debug('ReceiveWeave', 'Fetching creator profiles', { creatorIds });

        // Fetch profiles with photo_url (the column used for profile pictures)
        const { data: profiles, error: profileError } = await client
            .from('user_profiles')
            .select('id, display_name, username, photo_url')
            .in('id', creatorIds);

        logger.debug('ReceiveWeave', 'Profile fetch result', {
            profiles,
            profileError: profileError?.message,
            profileCount: profiles?.length || 0
        });

        const profileMap = new Map(
            (profiles || []).map((p: any) => [p.id, {
                name: p.display_name || p.username || 'Unknown',
                avatarUrl: p.photo_url // photo_url is the actual column name
            }])
        );

        return participants.map((p: any) => {
            const profile = profileMap.get(p.shared_weaves?.created_by);
            return {
                id: p.shared_weave_id,
                creatorUserId: p.shared_weaves?.created_by,
                creatorName: profile?.name || 'A friend',
                creatorAvatarUrl: profile?.avatarUrl,
                weaveDate: p.shared_weaves?.weave_date,
                title: p.shared_weaves?.title,
                location: p.shared_weaves?.location,
                category: p.shared_weaves?.category,
                duration: p.shared_weaves?.duration,
            };
        });

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to fetch pending weaves:', error);
        return [];
    }
}

/**
 * Fetch shared weave history (accepted/declined)
 */
export async function fetchSharedWeaveHistory(): Promise<(IncomingWeave & { status: 'accepted' | 'declined' })[]> {
    try {
        const client = getSupabaseClient();
        if (!client) return [];

        const { data: { user } } = await client.auth.getUser();
        if (!user) return [];

        // Get processed invitations
        const { data: participants, error: participantError } = await client
            .from('shared_weave_participants')
            .select(`
                response,
                shared_weave_id,
                shared_weaves (
                    id,
                    created_by,
                    weave_date,
                    title,
                    location,
                    category,
                    duration
                )
            `)
            .eq('user_id', user.id)
            .neq('response', 'pending')
            .order('responded_at', { ascending: false })
            .limit(20);

        if (participantError || !participants) {
            logger.error('ReceiveWeave', 'Failed to fetch history:', participantError);
            return [];
        }

        // Get creator names and photos
        const creatorIds = [...new Set(participants.map((p: any) => p.shared_weaves?.created_by).filter(Boolean))];

        const { data: profiles } = await client
            .from('user_profiles')
            .select('id, display_name, username, photo_url')
            .in('id', creatorIds);

        const profileMap = new Map(
            (profiles || []).map((p: any) => [p.id, {
                name: p.display_name || p.username || 'Unknown',
                photoUrl: p.photo_url
            }])
        );

        return participants.map((p: any) => {
            const profile = profileMap.get(p.shared_weaves?.created_by);
            return {
                id: p.shared_weave_id,
                creatorUserId: p.shared_weaves?.created_by,
                creatorName: profile?.name || 'A friend',
                creatorAvatarUrl: profile?.photoUrl,
                weaveDate: p.shared_weaves?.weave_date,
                title: p.shared_weaves?.title,
                location: p.shared_weaves?.location,
                category: p.shared_weaves?.category,
                duration: p.shared_weaves?.duration,
                status: p.response as 'accepted' | 'declined',
            };
        });

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to fetch history:', error);
        return [];
    }
}
