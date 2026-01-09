/**
 * usePendingWeavesForFriend Hook
 * 
 * Returns pending shared weaves from a specific friend (filtered by their linked account).
 * Used to show inline pending weaves on their friend profile.
 */

import { useMemo } from 'react';
import { usePendingWeaves } from './usePendingWeaves';
import { SharedWeaveData } from '../components/SharedWeaveCard';

interface UsePendingWeavesForFriendReturn {
    pendingWeaves: SharedWeaveData[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    handleAccept: (weaveId: string) => Promise<void>;
    handleDecline: (weaveId: string) => Promise<void>;
    processingId: string | null;
    hasPending: boolean;
}

/**
 * Hook to get pending weaves from a specific friend's linked Weave account.
 * 
 * @param linkedUserId - The Supabase user ID of the friend's linked account
 */
export function usePendingWeavesForFriend(linkedUserId: string | undefined): UsePendingWeavesForFriendReturn {
    const {
        pendingWeaves: allPendingWeaves,
        isLoading,
        error,
        refresh,
        handleAccept,
        handleDecline,
        processingId
    } = usePendingWeaves();

    // Filter pending weaves to only those from this specific friend
    const pendingWeaves = useMemo(() => {
        if (!linkedUserId) return [];
        return allPendingWeaves.filter(w => w.creatorUserId === linkedUserId);
    }, [allPendingWeaves, linkedUserId]);

    return {
        pendingWeaves,
        isLoading,
        error,
        refresh,
        handleAccept,
        handleDecline,
        processingId,
        hasPending: pendingWeaves.length > 0,
    };
}
