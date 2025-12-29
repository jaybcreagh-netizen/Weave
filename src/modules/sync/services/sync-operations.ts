/**
 * Sync Operations
 * 
 * Individual operation handlers for Supabase sync.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { database } from '@/db';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import { logger } from '@/shared/services/logger.service';
import { PushQueueService } from '@/modules/notifications/services/push-queue.service';

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

    // Send Push Notifications (Phase 4)
    // Using PushQueueService for reliable delivery (handles offline/retries)
    // Fire and forget - don't block sync success
    Promise.all(data.participantUserIds.map(async (recipientId) => {
        try {
            await PushQueueService.sendOrQueue(recipientId, {
                type: 'shared_weave',
                title: 'New Shared Weave',
                body: `${user.user_metadata.full_name || 'A friend'} shared "${data.title || 'a moment'}" with you.`,
                data: {
                    sharedWeaveId: sharedWeave.id,
                    action: 'view_shared_weave'
                }
            });
        } catch (err) {
            console.warn('Error queuing shared weave push:', err);
        }
    })).catch(err => console.error('Push notification batch failed', err));
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

    // Send Update Notifications
    try {
        // Fetch participants to notify
        const { data: participants } = await client
            .from('shared_weave_participants')
            .select('user_id')
            .eq('shared_weave_id', ref.serverWeaveId);

        if (participants) {
            const recipients = participants
                .map(p => p.user_id)
                .filter(uid => uid !== user.id); // Don't notify self

            Promise.all(recipients.map(async (recipientId) => {
                await PushQueueService.sendOrQueue(recipientId, {
                    type: 'shared_weave',
                    title: 'Weave Updated',
                    body: `${user.user_metadata.full_name || 'A friend'} updated "${data.title || 'the weave'}".`,
                    data: {
                        sharedWeaveId: ref.serverWeaveId,
                        action: 'view_shared_weave'
                    }
                });
            })).catch(err => console.error('Update push notification batch failed', err));
        }
    } catch (err) {
        console.warn('Error fetching participants for notification:', err);
    }
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

    // Notify Creator (Phase 4)
    try {
        const { data: weave } = await client
            .from('shared_weaves')
            .select('created_by, title')
            .eq('id', data.sharedWeaveId)
            .single();

        if (weave && weave.created_by !== user.id) {
            await PushQueueService.sendOrQueue(weave.created_by, {
                type: 'shared_weave',
                title: 'Friend Joining',
                body: `${user.user_metadata.full_name || 'A friend'} is joining "${weave.title || 'your plan'}".`,
                data: {
                    sharedWeaveId: data.sharedWeaveId,
                    action: 'view_shared_weave'
                }
            });
        }
    } catch (err) {
        console.warn('Error sending accept notification:', err);
    }
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
}
