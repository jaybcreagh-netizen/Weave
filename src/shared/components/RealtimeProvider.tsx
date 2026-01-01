/**
 * RealtimeProvider
 * 
 * Manages Supabase Realtime subscription lifecycle.
 * Subscribes when authenticated, unsubscribes on logout.
 * Registers handlers for real-time events and shows toasts/updates UI.
 */

import { useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/modules/auth';
import {
    subscribeToRealtime,
    unsubscribeFromRealtime,
    onIncomingWeave,
    onIncomingLink,
    onOutgoingLinkStatusChange,
    onParticipantResponse,
} from '@/modules/sync';
import { useUIStore } from '@/shared/stores/uiStore';
import { queryClient } from '@/shared/api/query-client';
import { logger } from '@/shared/services/logger.service';

interface RealtimeProviderProps {
    children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
    const { user } = useAuth();
    const showToast = useUIStore((state) => state.showToast);

    // Handler for incoming shared weaves (someone shared a weave with us)
    const handleIncomingWeave = useCallback(() => {
        logger.info('RealtimeProvider', 'Received incoming shared weave');
        showToast('New shared weave received!', 'Weave');
        // Invalidate pending weaves query so the list refreshes
        queryClient.invalidateQueries({ queryKey: ['pending-weaves'] });
    }, [showToast]);

    // Handler for incoming link requests (someone wants to link with us)
    const handleIncomingLink = useCallback(() => {
        logger.info('RealtimeProvider', 'Received incoming link request');
        showToast('New friend link request!', 'Link');
        // Invalidate link requests query
        queryClient.invalidateQueries({ queryKey: ['incoming-link-requests'] });
    }, [showToast]);

    // Handler for outgoing link status changes (our request was accepted/declined)
    const handleOutgoingLinkStatusChange = useCallback((payload: { status: string }) => {
        logger.info('RealtimeProvider', 'Outgoing link status changed', payload);

        if (payload.status === 'accepted') {
            showToast('Friend request accepted! 🎉', 'Link');
        } else if (payload.status === 'declined') {
            showToast('Friend request declined', 'Link');
        }

        // Invalidate queries that depend on link status
        queryClient.invalidateQueries({ queryKey: ['outgoing-link-requests'] });
        queryClient.invalidateQueries({ queryKey: ['linked-friends'] });
    }, [showToast]);

    // Handler for participant responses to weaves we shared
    const handleParticipantResponse = useCallback((payload: { response: string }) => {
        logger.info('RealtimeProvider', 'Participant responded to shared weave', payload);

        if (payload.response === 'accepted') {
            showToast('Someone accepted your shared weave!', 'Weave');
        } else if (payload.response === 'declined') {
            showToast('Someone declined your shared weave', 'Weave');
        }

        // Invalidate shared weave queries
        queryClient.invalidateQueries({ queryKey: ['shared-weave-responses'] });
    }, [showToast]);

    // Subscribe to realtime when authenticated
    useEffect(() => {
        if (!user?.id) {
            logger.debug('RealtimeProvider', 'No user, skipping realtime subscription');
            return;
        }

        logger.info('RealtimeProvider', 'Starting realtime subscription for user', { userId: user.id });

        // Subscribe to realtime channel
        subscribeToRealtime().catch((error) => {
            logger.error('RealtimeProvider', 'Failed to subscribe to realtime', error);
        });

        // Register event handlers
        const cleanupWeave = onIncomingWeave(handleIncomingWeave);
        const cleanupLink = onIncomingLink(handleIncomingLink);
        const cleanupOutgoingLink = onOutgoingLinkStatusChange(handleOutgoingLinkStatusChange);
        const cleanupParticipant = onParticipantResponse(handleParticipantResponse);

        // Cleanup on logout or unmount
        return () => {
            logger.info('RealtimeProvider', 'Cleaning up realtime subscription');
            cleanupWeave();
            cleanupLink();
            cleanupOutgoingLink();
            cleanupParticipant();
            unsubscribeFromRealtime().catch((error) => {
                logger.error('RealtimeProvider', 'Failed to unsubscribe from realtime', error);
            });
        };
    }, [
        user?.id,
        handleIncomingWeave,
        handleIncomingLink,
        handleOutgoingLinkStatusChange,
        handleParticipantResponse,
    ]);

    return <>{children}</>;
}
