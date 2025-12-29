/**
 * usePendingWeaves Hook
 * 
 * Hook to fetch and manage pending shared weaves.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchPendingSharedWeaves, acceptWeave, declineWeave } from '../services/receive-weave.service';
import { SharedWeaveData } from '../components/SharedWeaveCard';
import { logger } from '@/shared/services/logger.service';

interface UsePendingWeavesReturn {
    pendingWeaves: SharedWeaveData[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    handleAccept: (weaveId: string) => Promise<void>;
    handleDecline: (weaveId: string) => Promise<void>;
    processingId: string | null;
}

export function usePendingWeaves(): UsePendingWeavesReturn {
    const [pendingWeaves, setPendingWeaves] = useState<SharedWeaveData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const weaves = await fetchPendingSharedWeaves();

            // Transform to SharedWeaveData format
            const formattedWeaves: SharedWeaveData[] = weaves.map(w => ({
                id: w.id,
                creatorName: w.creatorName,
                weaveDate: new Date(w.weaveDate),
                title: w.title,
                location: w.location,
                category: w.category,
                duration: w.duration,
                status: 'pending' as const,
                sharedAt: new Date(), // Approximate
            }));

            setPendingWeaves(formattedWeaves);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch pending weaves';
            setError(message);
            logger.error('usePendingWeaves', 'Refresh failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleAccept = useCallback(async (weaveId: string) => {
        try {
            setProcessingId(weaveId);

            const weave = pendingWeaves.find(w => w.id === weaveId);
            if (!weave) throw new Error('Weave not found');

            // Get full weave data for accept
            const weaveData = {
                id: weave.id,
                creatorUserId: '', // Will be fetched from server
                creatorName: weave.creatorName,
                weaveDate: weave.weaveDate.toISOString(),
                title: weave.title,
                location: weave.location,
                category: weave.category,
                duration: weave.duration,
            };

            await acceptWeave(weaveId, weaveData);

            // Update local state
            setPendingWeaves(prev =>
                prev.map(w => w.id === weaveId ? { ...w, status: 'accepted' as const } : w)
            );

        } catch (err) {
            logger.error('usePendingWeaves', 'Accept failed:', err);
            throw err;
        } finally {
            setProcessingId(null);
        }
    }, [pendingWeaves]);

    const handleDecline = useCallback(async (weaveId: string) => {
        try {
            setProcessingId(weaveId);

            await declineWeave(weaveId);

            // Update local state
            setPendingWeaves(prev =>
                prev.map(w => w.id === weaveId ? { ...w, status: 'declined' as const } : w)
            );

        } catch (err) {
            logger.error('usePendingWeaves', 'Decline failed:', err);
            throw err;
        } finally {
            setProcessingId(null);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        pendingWeaves,
        isLoading,
        error,
        refresh,
        handleAccept,
        handleDecline,
        processingId,
    };
}
