/**
 * Realtime Subscription Service
 * 
 * Handles Supabase Realtime subscriptions for incoming shared weaves.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import { RealtimeChannel } from '@supabase/supabase-js';

// Singleton channel reference
let realtimeChannel: RealtimeChannel | null = null;

export interface IncomingWeavePayload {
    id: string;
    shared_weave_id: string;
    user_id: string;
    response: string;
    created_at: string;
}

export interface IncomingLinkPayload {
    id: string;
    user_a_id: string;
    user_b_id: string;
    status: string;
    initiated_by: string;
    created_at: string;
}

type IncomingWeaveHandler = (payload: IncomingWeavePayload) => void;
type IncomingLinkHandler = (payload: IncomingLinkPayload) => void;

let weaveHandlers: IncomingWeaveHandler[] = [];
let linkHandlers: IncomingLinkHandler[] = [];

/**
 * Subscribe to incoming shared weaves and friend links
 */
export async function subscribeToRealtime(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
        logger.warn('Realtime', 'No Supabase client - cannot subscribe');
        return;
    }

    // Get current user
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        logger.warn('Realtime', 'Not authenticated - cannot subscribe');
        return;
    }

    // Unsubscribe from any existing channel
    if (realtimeChannel) {
        await unsubscribeFromRealtime();
    }

    // Subscribe to shared_weave_participants for this user
    realtimeChannel = client
        .channel('user-notifications')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'shared_weave_participants',
                filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
                logger.info('Realtime', 'Incoming shared weave', payload);
                const data = payload.new as IncomingWeavePayload;
                weaveHandlers.forEach(handler => handler(data));
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'friend_links',
                filter: `user_b_id=eq.${user.id}`,
            },
            (payload) => {
                logger.info('Realtime', 'Incoming friend link request', payload);
                const data = payload.new as IncomingLinkPayload;
                linkHandlers.forEach(handler => handler(data));
            }
        )
        .subscribe((status) => {
            logger.info('Realtime', `Subscription status: ${status}`);
        });
}

/**
 * Unsubscribe from Realtime
 */
export async function unsubscribeFromRealtime(): Promise<void> {
    if (realtimeChannel) {
        const client = getSupabaseClient();
        if (client) {
            await client.removeChannel(realtimeChannel);
        }
        realtimeChannel = null;
        logger.info('Realtime', 'Unsubscribed from channel');
    }
}

/**
 * Register a handler for incoming shared weaves
 */
export function onIncomingWeave(handler: IncomingWeaveHandler): () => void {
    weaveHandlers.push(handler);
    return () => {
        weaveHandlers = weaveHandlers.filter(h => h !== handler);
    };
}

/**
 * Register a handler for incoming friend link requests
 */
export function onIncomingLink(handler: IncomingLinkHandler): () => void {
    linkHandlers.push(handler);
    return () => {
        linkHandlers = linkHandlers.filter(h => h !== handler);
    };
}
