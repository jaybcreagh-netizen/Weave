/**
 * Share Weave Service
 * 
 * Handles the logic for sharing weaves with linked friends.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import Friend from '@/db/models/Friend';
import { enqueueOperation } from './action-queue.service';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';

interface ShareWeaveOptions {
    interactionId: string;
    linkedFriendIds: string[]; // Local Friend IDs that are linked
}

/**
 * Share an existing interaction with linked friends
 */
export async function shareWeave({ interactionId, linkedFriendIds }: ShareWeaveOptions): Promise<void> {
    try {
        // Get the interaction
        const interaction = await database.get<Interaction>('interactions').find(interactionId);
        if (!interaction) {
            throw new Error('Interaction not found');
        }

        // Get linked friends using the optimized helper
        const linkedFriends = await getLinkedFriendsFromIds(linkedFriendIds);

        // Filter to only friends with linked user IDs (helper already does this, but keeping map for safety/types)
        const participantUserIds = linkedFriends
            .map(f => f.linkedUserId as string);

        if (participantUserIds.length === 0) {
            logger.warn('ShareWeave', 'No linked friends with user IDs to share with');
            return;
        }

        // Get current user ID
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('No Supabase client');
        }

        const { data: { user } } = await client.auth.getUser();
        if (!user) {
            throw new Error('Not authenticated');
        }

        // Create local SharedWeaveRef
        // Note: serverWeaveId will be populated after sync
        const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');

        await database.write(async () => {
            await refCollection.create(ref => {
                ref.interactionId = interactionId;
                ref.serverWeaveId = ''; // Will be set after sync
                ref.createdByUserId = user.id;
                ref.isCreator = true;
                ref.status = 'pending';
                ref.sharedAt = Date.now();
            });
        });

        // Enqueue sync operation
        await enqueueOperation('share_weave', {
            interactionId,
            weaveDate: interaction.interactionDate.toISOString(),
            title: interaction.title,
            location: interaction.location,
            category: interaction.interactionCategory,
            duration: interaction.duration,
            participantUserIds,
        });

        logger.info('ShareWeave', 'Weave queued for sharing', {
            interactionId,
            participantCount: participantUserIds.length
        });

    } catch (error) {
        logger.error('ShareWeave', 'Failed to share weave:', error);
        throw error;
    }
}

/**
 * Check if an interaction has been shared
 */
export async function getShareStatus(interactionId: string): Promise<{
    isShared: boolean;
    status?: 'pending' | 'accepted' | 'declined' | 'expired';
    sharedAt?: number;
}> {
    const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
    const refs = await refCollection.query().fetch();
    const ref = refs.find(r => r.interactionId === interactionId);

    if (!ref) {
        return { isShared: false };
    }

    return {
        isShared: true,
        status: ref.status as 'pending' | 'accepted' | 'declined' | 'expired',
        sharedAt: ref.sharedAt,
    };
}

/**
 * Sync participant responses for shared weaves where current user is creator
 * Updates local SharedWeaveRef status based on server participant responses
 */
export async function syncSharedWeaveResponses(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    try {
        // Get all local SharedWeaveRefs where we are the creator and status is pending
        const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
        const allRefs = await refCollection.query().fetch();
        const pendingCreatorRefs = allRefs.filter(
            r => r.isCreator && r.status === 'pending' && r.serverWeaveId
        );

        if (pendingCreatorRefs.length === 0) {
            return;
        }

        logger.info('ShareWeave', `Syncing ${pendingCreatorRefs.length} pending shared weave responses`);

        // Get server weave IDs
        const serverWeaveIds = pendingCreatorRefs.map(r => r.serverWeaveId);

        // Query server for participant responses
        const { data: participants, error } = await client
            .from('shared_weave_participants')
            .select('shared_weave_id, user_id, response, responded_at')
            .in('shared_weave_id', serverWeaveIds);

        if (error) {
            logger.error('ShareWeave', 'Error fetching participant responses:', error);
            return;
        }

        if (!participants || participants.length === 0) {
            return;
        }

        // Group responses by shared_weave_id
        const responsesByWeave = new Map<string, Array<{ response: string; responded_at: string | null }>>();
        for (const p of participants) {
            const existing = responsesByWeave.get(p.shared_weave_id) || [];
            existing.push({ response: p.response, responded_at: p.responded_at });
            responsesByWeave.set(p.shared_weave_id, existing);
        }

        // Update local refs based on aggregated responses
        await database.write(async () => {
            for (const ref of pendingCreatorRefs) {
                const responses = responsesByWeave.get(ref.serverWeaveId);
                if (!responses) continue;

                // Determine overall status:
                // - If any participant accepted, mark as accepted
                // - If all declined, mark as declined
                // - Otherwise keep as pending
                const hasAccepted = responses.some(r => r.response === 'accepted');
                const allDeclined = responses.every(r => r.response === 'declined');

                let newStatus: string | null = null;
                if (hasAccepted) {
                    newStatus = 'accepted';
                } else if (allDeclined && responses.length > 0) {
                    newStatus = 'declined';
                }

                if (newStatus && newStatus !== ref.status) {
                    logger.info('ShareWeave', `Updating shared weave ${ref.serverWeaveId} status to ${newStatus}`);
                    await ref.update(r => {
                        r.status = newStatus as 'pending' | 'accepted' | 'declined' | 'expired';
                        if (newStatus === 'accepted' || newStatus === 'declined') {
                            const respondedAt = responses.find(r => r.responded_at)?.responded_at;
                            if (respondedAt) {
                                r.respondedAt = new Date(respondedAt).getTime();
                            }
                        }
                    });
                }
            }
        });

        logger.info('ShareWeave', 'Finished syncing shared weave responses');
    } catch (e) {
        logger.error('ShareWeave', 'Exception syncing shared weave responses:', e);
    }
}

/**
 * Get linked friends from a list of friend IDs
 */
export async function getLinkedFriendsFromIds(friendIds: string[]): Promise<Friend[]> {
    if (!friendIds || friendIds.length === 0) {
        return [];
    }

    const friendsCollection = database.get<Friend>('friends');

    // Use a single batched query instead of N+1 individual lookups
    const friends = await friendsCollection
        .query(Q.where('id', Q.oneOf(friendIds)))
        .fetch();

    return friends.filter(f =>
        f.linkStatus === 'linked' && !!f.linkedUserId
    );
}
