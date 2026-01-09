/**
 * Sync Operations
 * 
 * Individual operation handlers for Supabase sync.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { database } from '@/db';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import Friend from '@/db/models/Friend';
import { logger } from '@/shared/services/logger.service';
import { PushQueueService } from '@/modules/notifications/services/push-queue.service';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

// =============================================================================
// SHARE WEAVE
// =============================================================================

interface ShareWeavePayload {
    interactionId: string;
    weaveDate: string; // ISO string
    title?: string;
    location?: string;
    category: string;
    duration?: string;
    note?: string;
    participantUserIds: string[]; // Supabase user IDs to share with
}

/**
 * Share a weave to the cloud
 */
export async function executeShareWeave(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as ShareWeavePayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    // Get current user
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create shared_weave on server
    const { data: sharedWeave, error: weaveError } = await client
        .from('shared_weaves')
        .insert({
            created_by: user.id,
            weave_date: data.weaveDate,
            title: data.title,
            location: data.location,
            category: data.category,
            duration: data.duration,
            note: data.note,
            status: 'pending',
            can_participant_edit: false, // Default to false for MVP
            last_edited_by: user.id,
            last_edited_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (weaveError || !sharedWeave) {
        throw new Error(`Failed to create shared weave: ${weaveError?.message}`);
    }

    // Add participants
    const participantInserts = data.participantUserIds.map(userId => ({
        shared_weave_id: sharedWeave.id,
        user_id: userId,
        response: 'pending',
        role: 'viewer', // Default role
    }));

    const { error: participantError } = await client
        .from('shared_weave_participants')
        .insert(participantInserts);

    if (participantError) {
        throw new Error(`Failed to add participants: ${participantError.message}`);
    }

    // Create local SharedWeaveRef
    const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
    await database.write(async () => {
        await refCollection.create(ref => {
            ref.interactionId = data.interactionId;
            ref.serverWeaveId = sharedWeave.id;
            ref.createdByUserId = user.id;
            ref.isCreator = true;
            ref.status = 'accepted';
            ref.sharedAt = Date.now();
            ref.canParticipantEdit = false;
        });
    });

    logger.info('SyncOps', 'Shared weave created', { serverWeaveId: sharedWeave.id });

    // Track analytics for observability
    trackEvent(AnalyticsEvents.SHARED_WEAVE_CREATED, {
        participant_count: data.participantUserIds.length,
        has_title: !!data.title,
        has_location: !!data.location,
        category: data.category,
    });

    // NOTE: Push Notifications are now handled by database triggers (on_shared_weave_participant_added)
    // This prevents duplicate notifications and ensures reliability even if client disconnects immediately.
}

// =============================================================================
// UPDATE SHARED WEAVE
// =============================================================================

interface UpdateSharedWeavePayload {
    interactionId: string; // Local ID to find the ref
    title?: string;
    weaveDate?: string;
    location?: string;
    category?: string;
    duration?: string;
    note?: string;
}

/**
 * Update a shared weave
 */
export async function executeUpdateSharedWeave(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as UpdateSharedWeavePayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Find local ref to get server ID
    const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
    const refs = await refCollection.query().fetch();
    const ref = refs.find(r => r.interactionId === data.interactionId);

    if (!ref) {
        throw new Error(`SharedWeaveRef not found for interaction ${data.interactionId}`);
    }

    // Build update object
    const updates: any = {
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updates.title = data.title;
    if (data.weaveDate !== undefined) updates.weave_date = data.weaveDate;
    if (data.location !== undefined) updates.location = data.location;
    if (data.category !== undefined) updates.category = data.category;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.note !== undefined) updates.note = data.note;

    // Perform update on server
    const { error } = await client
        .from('shared_weaves')
        .update(updates)
        .eq('id', ref.serverWeaveId);

    if (error) {
        throw new Error(`Failed to update shared weave: ${error.message}`);
    }

    logger.info('SyncOps', 'Updated shared weave', { serverWeaveId: ref.serverWeaveId });

    // NOTE: Push Notifications handled by server triggers
    // Future: Implement notify_shared_weave_update trigger if needed
}

// =============================================================================
// ACCEPT WEAVE
// =============================================================================

interface AcceptWeavePayload {
    sharedWeaveId: string;
    localInteractionId: string;
}

/**
 * Accept a shared weave
 */
export async function executeAcceptWeave(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as AcceptWeavePayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Update participant response
    const { error } = await client
        .from('shared_weave_participants')
        .update({
            response: 'accepted',
            responded_at: new Date().toISOString(),
            local_interaction_id: data.localInteractionId,
        })
        .eq('shared_weave_id', data.sharedWeaveId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error(`Failed to accept weave: ${error.message}`);
    }

    // Update local SharedWeaveRef
    const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
    const refs = await refCollection
        .query()
        .fetch();

    const ref = refs.find(r => r.serverWeaveId === data.sharedWeaveId);
    if (ref) {
        await database.write(async () => {
            await ref.update(r => {
                r.status = 'accepted';
                r.respondedAt = Date.now();
            });
        });
    }

    logger.info('SyncOps', 'Accepted shared weave', { sharedWeaveId: data.sharedWeaveId });

    // Track analytics for observability
    trackEvent(AnalyticsEvents.SHARED_WEAVE_ACCEPTED);

    // NOTE: Push Notifications handled by database trigger (on_shared_weave_participant_accepted)
}

// =============================================================================
// DECLINE WEAVE
// =============================================================================

interface DeclineWeavePayload {
    sharedWeaveId: string;
}

/**
 * Decline a shared weave
 */
export async function executeDeclineWeave(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as DeclineWeavePayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Update participant response
    const { error } = await client
        .from('shared_weave_participants')
        .update({
            response: 'declined',
            responded_at: new Date().toISOString(),
        })
        .eq('shared_weave_id', data.sharedWeaveId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error(`Failed to decline weave: ${error.message}`);
    }

    // Update local SharedWeaveRef if exists
    const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
    const refs = await refCollection.query().fetch();
    const ref = refs.find(r => r.serverWeaveId === data.sharedWeaveId);

    if (ref) {
        await database.write(async () => {
            await ref.update(r => {
                r.status = 'declined';
                r.respondedAt = Date.now();
            });
        });
    }

    logger.info('SyncOps', 'Declined shared weave', { sharedWeaveId: data.sharedWeaveId });

    // Track analytics for observability
    trackEvent(AnalyticsEvents.SHARED_WEAVE_DECLINED);
}

// =============================================================================
// SEND LINK REQUEST
// =============================================================================

interface SendLinkRequestPayload {
    localFriendId: string;
    targetUserId: string;
    requesterId: string;
}

/**
 * Execute a friend link request on the server
 * Idempotent: Checks for existing pending request before creating
 */
export async function executeSendLinkRequest(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as SendLinkRequestPayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    // Sort user IDs to satisfy CHECK constraint (user_a_id < user_b_id)
    const [userAId, userBId] = [data.requesterId, data.targetUserId].sort();
    const isRequesterUserA = userAId === data.requesterId;

    // Idempotency: Check if request already exists (check both orderings)
    const { data: existing } = await client
        .from('friend_links')
        .select('id, status')
        .eq('user_a_id', userAId)
        .eq('user_b_id', userBId)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

    if (existing) {
        logger.info('SyncOps', 'Link request already exists', {
            existingId: existing.id,
            status: existing.status
        });
        // Update local friend with server link status
        await updateLocalFriendLinkStatus(
            data.localFriendId,
            existing.status === 'accepted' ? 'linked' : 'pending_sent',
            existing.id
        );
        return;
    }

    // Create new link request with properly ordered IDs
    const { data: linkData, error } = await client
        .from('friend_links')
        .insert({
            user_a_id: userAId,
            user_b_id: userBId,
            // Store local friend ID in the correct column based on who's user A
            user_a_friend_id: isRequesterUserA ? data.localFriendId : undefined,
            user_b_friend_id: isRequesterUserA ? undefined : data.localFriendId,
            initiated_by: data.requesterId,
            status: 'pending',
        })
        .select('id')
        .single();

    if (error) {
        // Handle specific errors
        if (error.code === '23505') {  // Unique violation (race condition)
            logger.warn('SyncOps', 'Duplicate link request (race condition)', error);
            return;  // Treat as success
        }
        throw new Error(`Failed to create link request: ${error.message}`);
    }

    // Update local friend with server link ID
    await updateLocalFriendLinkStatus(data.localFriendId, 'pending_sent', linkData.id);

    logger.info('SyncOps', 'Link request created', { linkId: linkData.id });
    trackEvent(AnalyticsEvents.FRIEND_LINK_SENT);
}

// =============================================================================
// ACCEPT LINK REQUEST
// =============================================================================

interface AcceptLinkRequestPayload {
    linkId: string;
    localFriendId?: string;  // Optional: existing local friend to update
    requesterUserId: string;
    tier: 'InnerCircle' | 'CloseFriends' | 'Community';
    requesterProfile: {
        displayName: string;
        photoUrl?: string;
        archetype?: string;
        birthday?: string;
    };
}

/**
 * Accept an incoming link request
 */
export async function executeAcceptLinkRequest(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as AcceptLinkRequestPayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Update link status to accepted
    const { error } = await client
        .from('friend_links')
        .update({
            status: 'accepted',
            linked_at: new Date().toISOString(),
            user_b_friend_id: data.localFriendId,
        })
        .eq('id', data.linkId);

    if (error) {
        throw new Error(`Failed to accept link request: ${error.message}`);
    }

    // Update/create local friend
    await database.write(async () => {
        if (data.localFriendId) {
            try {
                const friend = await database.get<Friend>('friends').find(data.localFriendId);
                await friend.update(f => {
                    f.linkedUserId = data.requesterUserId;
                    f.linkStatus = 'linked';
                    f.linkedAt = Date.now();
                    if (data.requesterProfile.photoUrl && !f.photoUrl) {
                        f.photoUrl = data.requesterProfile.photoUrl;
                    }
                    if (data.requesterProfile.birthday && !f.birthday) {
                        f.birthday = data.requesterProfile.birthday;
                    }
                });
            } catch {
                logger.warn('SyncOps', 'Local friend not found for accept', { friendId: data.localFriendId });
            }
        } else {
            // Create new friend from linked user
            await database.get<Friend>('friends').create(friend => {
                friend.name = data.requesterProfile.displayName;
                friend.dunbarTier = data.tier;
                friend.archetype = (data.requesterProfile.archetype as any) || 'Hermit';
                friend.weaveScore = 50;
                friend.photoUrl = data.requesterProfile.photoUrl;
                friend.birthday = data.requesterProfile.birthday;
                friend.lastUpdated = new Date();
                friend.resilience = 0;
                friend.ratedWeavesCount = 0;
                friend.momentumScore = 0;
                friend.momentumLastUpdated = new Date();
                friend.isDormant = false;
                friend.outcomeCount = 0;
                friend.initiationRatio = 0.5;
                friend.consecutiveUserInitiations = 0;
                friend.totalUserInitiations = 0;
                friend.totalFriendInitiations = 0;
                friend.linkedUserId = data.requesterUserId;
                friend.linkStatus = 'linked';
                friend.linkedAt = Date.now();
            });
        }
    });

    logger.info('SyncOps', 'Accepted link request', { linkId: data.linkId });
    trackEvent(AnalyticsEvents.FRIEND_LINK_ACCEPTED);
}

// =============================================================================
// DECLINE LINK REQUEST
// =============================================================================

interface DeclineLinkRequestPayload {
    linkId: string;
}

/**
 * Decline an incoming link request
 */
export async function executeDeclineLinkRequest(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as DeclineLinkRequestPayload;
    const client = getSupabaseClient();
    if (!client) throw new Error('No Supabase client');

    const { error } = await client
        .from('friend_links')
        .update({ status: 'declined' })
        .eq('id', data.linkId);

    if (error) {
        throw new Error(`Failed to decline link request: ${error.message}`);
    }

    logger.info('SyncOps', 'Declined link request', { linkId: data.linkId });
    trackEvent(AnalyticsEvents.FRIEND_LINK_DECLINED);
}

// =============================================================================
// HELPER: Update Local Friend Link Status
// =============================================================================

/**
 * Helper to update local friend link status after sync
 */
async function updateLocalFriendLinkStatus(
    friendId: string,
    status: string,
    serverLinkId?: string
): Promise<void> {
    await database.write(async () => {
        try {
            const friend = await database.get<Friend>('friends').find(friendId);
            await friend.update(f => {
                f.linkStatus = status as any;
                if (serverLinkId) {
                    f.serverLinkId = serverLinkId;
                }
            });
        } catch {
            logger.warn('SyncOps', 'Friend not found for status update', { friendId });
        }
    });
}
