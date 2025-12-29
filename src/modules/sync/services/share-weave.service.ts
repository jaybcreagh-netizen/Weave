/**
 * Share Weave Service
 * 
 * Handles the logic for sharing weaves with linked friends.
 */

import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import Friend from '@/db/models/Friend';
import { enqueueOperation } from './sync-engine.service';
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

        // Get linked friends to get their Supabase user IDs
        const friendsCollection = database.get<Friend>('friends');
        const linkedFriends = await Promise.all(
            linkedFriendIds.map(id => friendsCollection.find(id))
        );

        // Filter to only friends with linked user IDs
        const participantUserIds = linkedFriends
            .filter(f => f.linkedUserId)
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
 * Get linked friends from a list of friend IDs
 */
export async function getLinkedFriendsFromIds(friendIds: string[]): Promise<Friend[]> {
    const friendsCollection = database.get<Friend>('friends');
    const friends = await Promise.all(
        friendIds.map(async id => {
            try {
                return await friendsCollection.find(id);
            } catch {
                return null;
            }
        })
    );

    return friends.filter((f): f is Friend =>
        f !== null && f.linkStatus === 'linked' && !!f.linkedUserId
    );
}
