/**
 * Realtime Subscription Service
 * 
 * Handles Supabase Realtime subscriptions for incoming shared weaves.
 * 
 * Features:
 * - Handler deduplication (prevents duplicate registrations)
 * - Auto-reconnect with exponential backoff
 * - Connection status monitoring
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import { RealtimeChannel } from '@supabase/supabase-js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

// =============================================================================
// STATE
// =============================================================================

// Singleton channel reference
let realtimeChannel: RealtimeChannel | null = null;

// Reconnect state
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isManuallyDisconnected = false;

// Handler Sets for O(1) deduplication
const weaveHandlerSet = new Set<IncomingWeaveHandler>();
const linkHandlerSet = new Set<IncomingLinkHandler>();
const outgoingLinkHandlerSet = new Set<OutgoingLinkStatusHandler>();
const participantResponseHandlerSet = new Set<ParticipantResponseHandler>();

// =============================================================================
// TYPES
// =============================================================================

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
type OutgoingLinkStatusHandler = (payload: IncomingLinkPayload) => void;
type ParticipantResponseHandler = (payload: IncomingWeavePayload) => void;

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Subscribe to incoming shared weaves and friend links
 * Includes auto-reconnect logic on disconnection
 */
export async function subscribeToRealtime(): Promise<void> {
    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Reset manual disconnect flag
    isManuallyDisconnected = false;

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

    logger.info('Realtime', `Subscribing to realtime (attempt ${reconnectAttempts + 1})`);

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
                weaveHandlerSet.forEach(handler => handler(data));
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
                linkHandlerSet.forEach(handler => handler(data));
            }
        )
        // UPDATE: When OUR outgoing link request status changes (accepted/declined)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'friend_links',
                filter: `user_a_id=eq.${user.id}`,
            },
            (payload) => {
                logger.info('Realtime', 'Outgoing link status changed', payload);
                const data = payload.new as IncomingLinkPayload;
                outgoingLinkHandlerSet.forEach(handler => handler(data));
            }
        )
        // UPDATE: When someone responds to a weave WE shared
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'shared_weave_participants',
                // No filter here - we need to check if we're the creator in the handler
            },
            (payload) => {
                logger.info('Realtime', 'Participant response to shared weave', payload);
                const data = payload.new as IncomingWeavePayload;
                participantResponseHandlerSet.forEach(handler => handler(data));
            }
        )
        .subscribe((status, err) => {
            handleSubscriptionStatus(status, err);
        });
}

/**
 * Handle subscription status changes
 * Triggers reconnect on disconnect if not manually disconnected
 */
function handleSubscriptionStatus(
    status: string,
    err?: Error
): void {
    logger.info('Realtime', `Subscription status: ${status}`, err ? { error: err.message } : {});

    switch (status) {
        case 'SUBSCRIBED':
            // Connection successful - reset reconnect counter
            reconnectAttempts = 0;
            logger.info('Realtime', '✅ Successfully connected to realtime');
            break;

        case 'CLOSED':
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
            // Connection lost - attempt reconnect if not manually disconnected
            if (!isManuallyDisconnected) {
                scheduleReconnect();
            }
            break;

        case 'UNSUBSCRIBED':
            // Expected state after manual unsubscribe
            logger.debug('Realtime', 'Channel unsubscribed');
            break;
    }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect(): void {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error('Realtime', `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
        return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts)
    );

    reconnectAttempts++;

    logger.info('Realtime', `Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        subscribeToRealtime();
    }, delay);
}

/**
 * Unsubscribe from Realtime
 */
export async function unsubscribeFromRealtime(): Promise<void> {
    // Mark as manually disconnected to prevent auto-reconnect
    isManuallyDisconnected = true;

    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (realtimeChannel) {
        const client = getSupabaseClient();
        if (client) {
            await client.removeChannel(realtimeChannel);
        }
        realtimeChannel = null;
        logger.info('Realtime', 'Unsubscribed from channel');
    }

    // Reset reconnect counter
    reconnectAttempts = 0;
}

// =============================================================================
// HANDLER REGISTRATION (with deduplication)
// =============================================================================

/**
 * Register a handler for incoming shared weaves
 * Uses Set for O(1) deduplication - same handler won't be registered twice
 * 
 * @returns Cleanup function to unregister the handler
 */
export function onIncomingWeave(handler: IncomingWeaveHandler): () => void {
    if (weaveHandlerSet.has(handler)) {
        logger.debug('Realtime', 'Weave handler already registered, skipping duplicate');
        return () => {
            weaveHandlerSet.delete(handler);
        };
    }

    weaveHandlerSet.add(handler);
    logger.debug('Realtime', `Registered weave handler (total: ${weaveHandlerSet.size})`);

    return () => {
        weaveHandlerSet.delete(handler);
        logger.debug('Realtime', `Unregistered weave handler (total: ${weaveHandlerSet.size})`);
    };
}

/**
 * Register a handler for incoming friend link requests
 * Uses Set for O(1) deduplication - same handler won't be registered twice
 * 
 * @returns Cleanup function to unregister the handler
 */
export function onIncomingLink(handler: IncomingLinkHandler): () => void {
    if (linkHandlerSet.has(handler)) {
        logger.debug('Realtime', 'Link handler already registered, skipping duplicate');
        return () => {
            linkHandlerSet.delete(handler);
        };
    }

    linkHandlerSet.add(handler);
    logger.debug('Realtime', `Registered link handler (total: ${linkHandlerSet.size})`);

    return () => {
        linkHandlerSet.delete(handler);
        logger.debug('Realtime', `Unregistered link handler (total: ${linkHandlerSet.size})`);
    };
}

/**
 * Register a handler for outgoing link status changes (when someone accepts/declines our request)
 * Uses Set for O(1) deduplication - same handler won't be registered twice
 * 
 * @returns Cleanup function to unregister the handler
 */
export function onOutgoingLinkStatusChange(handler: OutgoingLinkStatusHandler): () => void {
    if (outgoingLinkHandlerSet.has(handler)) {
        logger.debug('Realtime', 'Outgoing link handler already registered, skipping duplicate');
        return () => {
            outgoingLinkHandlerSet.delete(handler);
        };
    }

    outgoingLinkHandlerSet.add(handler);
    logger.debug('Realtime', `Registered outgoing link handler (total: ${outgoingLinkHandlerSet.size})`);

    return () => {
        outgoingLinkHandlerSet.delete(handler);
        logger.debug('Realtime', `Unregistered outgoing link handler (total: ${outgoingLinkHandlerSet.size})`);
    };
}

/**
 * Register a handler for participant responses to weaves we shared
 * Uses Set for O(1) deduplication - same handler won't be registered twice
 * 
 * @returns Cleanup function to unregister the handler
 */
export function onParticipantResponse(handler: ParticipantResponseHandler): () => void {
    if (participantResponseHandlerSet.has(handler)) {
        logger.debug('Realtime', 'Participant response handler already registered, skipping duplicate');
        return () => {
            participantResponseHandlerSet.delete(handler);
        };
    }

    participantResponseHandlerSet.add(handler);
    logger.debug('Realtime', `Registered participant response handler (total: ${participantResponseHandlerSet.size})`);

    return () => {
        participantResponseHandlerSet.delete(handler);
        logger.debug('Realtime', `Unregistered participant response handler (total: ${participantResponseHandlerSet.size})`);
    };
}

// =============================================================================
// STATUS UTILITIES
// =============================================================================

/**
 * Get current connection status
 */
export function getRealtimeStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    handlerCounts: {
        weave: number;
        link: number;
        outgoingLink: number;
        participantResponse: number;
    };
} {
    return {
        isConnected: realtimeChannel !== null && !isManuallyDisconnected,
        reconnectAttempts,
        handlerCounts: {
            weave: weaveHandlerSet.size,
            link: linkHandlerSet.size,
            outgoingLink: outgoingLinkHandlerSet.size,
            participantResponse: participantResponseHandlerSet.size,
        },
    };
}

/**
 * Force a reconnection (useful after network recovery)
 */
export async function forceReconnect(): Promise<void> {
    reconnectAttempts = 0;
    await subscribeToRealtime();
}
