/**
 * Receive Weave Service
 * 
 * Handles accepting and declining incoming shared weaves.
 */

import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import Friend from '@/db/models/Friend';
import { enqueueOperation } from './action-queue.service';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import { Q } from '@nozbe/watermelondb';

interface IncomingWeave {
    id: string; // server shared_weave_id
    creatorUserId: string;
    creatorName: string;
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

        // Find the linked friend record for the creator
        const friendsCollection = database.get<Friend>('friends');
        const linkedFriends = await friendsCollection
            .query(Q.where('linked_user_id', weaveData.creatorUserId))
            .fetch();

        const creatorFriend = linkedFriends.length > 0 ? linkedFriends[0] : null;

        let interactionId = '';

        await database.write(async () => {
            // Create local interaction
            const interactionsCollection = database.get<Interaction>('interactions');
            const interaction = await interactionsCollection.create(record => {
                record.interactionDate = new Date(weaveData.weaveDate);
                record.interactionType = 'log';
                record.interactionCategory = weaveData.category;
                record.activity = weaveData.category;
                record.title = weaveData.title;
                record.location = weaveData.location;
                record.duration = weaveData.duration;
                record.status = 'completed';
                record.mode = 'one-on-one';
            });

            interactionId = interaction.id;

            // Link to creator friend if we have them
            if (creatorFriend) {
                const joinCollection = database.get<InteractionFriend>('interaction_friends');
                await joinCollection.create(record => {
                    record.interactionId = interaction.id;
                    record.friendId = creatorFriend.id;
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

        // Get creator names
        const creatorIds = [...new Set(participants.map((p: any) => p.shared_weaves?.created_by).filter(Boolean))];

        const { data: profiles } = await client
            .from('user_profiles')
            .select('user_id, display_name, username')
            .in('user_id', creatorIds);

        const profileMap = new Map(
            (profiles || []).map((p: any) => [p.user_id, p.display_name || p.username || 'Unknown'])
        );

        return participants.map((p: any) => ({
            id: p.shared_weave_id,
            creatorUserId: p.shared_weaves?.created_by,
            creatorName: profileMap.get(p.shared_weaves?.created_by) || 'A friend',
            weaveDate: p.shared_weaves?.weave_date,
            title: p.shared_weaves?.title,
            location: p.shared_weaves?.location,
            category: p.shared_weaves?.category,
            duration: p.shared_weaves?.duration,
        }));

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

        // Get creator names
        const creatorIds = [...new Set(participants.map((p: any) => p.shared_weaves?.created_by).filter(Boolean))];

        const { data: profiles } = await client
            .from('user_profiles')
            .select('user_id, display_name, username')
            .in('user_id', creatorIds);

        const profileMap = new Map(
            (profiles || []).map((p: any) => [p.user_id, p.display_name || p.username || 'Unknown'])
        );

        return participants.map((p: any) => ({
            id: p.shared_weave_id,
            creatorUserId: p.shared_weaves?.created_by,
            creatorName: profileMap.get(p.shared_weaves?.created_by) || 'A friend',
            weaveDate: p.shared_weaves?.weave_date,
            title: p.shared_weaves?.title,
            location: p.shared_weaves?.location,
            category: p.shared_weaves?.category,
            duration: p.shared_weaves?.duration,
            status: p.response as 'accepted' | 'declined',
        }));

    } catch (error) {
        logger.error('ReceiveWeave', 'Failed to fetch history:', error);
        return [];
    }
}
