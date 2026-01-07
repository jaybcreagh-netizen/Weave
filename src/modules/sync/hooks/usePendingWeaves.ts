/**
 * usePendingWeaves Hook
 * 
 * Hook to fetch and manage pending shared weaves.
 * Uses React Query for data fetching and mutations.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingSharedWeaves, acceptWeave, declineWeave } from '../services/receive-weave.service';
import { SharedWeaveData } from '../components/SharedWeaveCard';
import { logger } from '@/shared/services/logger.service';
import { useUIStore } from '@/shared/stores/uiStore';

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
    const queryClient = useQueryClient();
    const showToast = useUIStore(state => state.showToast);

    // Query for pending weaves
    const {
        data: pendingWeaves = [],
        isLoading,
        error: queryError,
        refetch
    } = useQuery({
        queryKey: ['pending-weaves'],
        queryFn: async () => {
            const weaves = await fetchPendingSharedWeaves();

            // Transform to SharedWeaveData format
            return weaves.map(w => ({
                id: w.id,
                creatorUserId: w.creatorUserId,
                creatorName: w.creatorName,
                weaveDate: new Date(w.weaveDate),
                title: w.title,
                location: w.location,
                category: w.category,
                duration: w.duration,
                status: 'pending' as const,
                sharedAt: new Date(), // Approximate
            }));
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Accept Mutation
    const acceptMutation = useMutation({
        mutationFn: async (weaveId: string) => {
            const weave = pendingWeaves.find(w => w.id === weaveId);
            if (!weave) throw new Error('Weave not found');

            // Reconstruct IncomingWeave data
            const weaveData = {
                id: weave.id,
                creatorUserId: weave.creatorUserId,
                creatorName: weave.creatorName,
                weaveDate: weave.weaveDate.toISOString(),
                title: weave.title,
                location: weave.location,
                category: weave.category,
                duration: weave.duration,
            };

            await acceptWeave(weaveId, weaveData);
            return weaveId;
        },
        onSuccess: (weaveId) => {
            logger.info('usePendingWeaves', 'Accept mutation success', { weaveId });
            showToast('Weave accepted! It will appear in your timeline.', 'Weave');
            // Optimistically update or invalidate
            queryClient.setQueryData(['pending-weaves'], (old: SharedWeaveData[] | undefined) =>
                old ? old.filter(w => w.id !== weaveId) : []
            );
            // Also invalidate to be sure
            queryClient.invalidateQueries({ queryKey: ['pending-weaves'] });
        },
        onError: (err) => {
            logger.error('usePendingWeaves', 'Accept mutation failed', err);
            showToast('Failed to accept weave: ' + (err instanceof Error ? err.message : 'Unknown error'), 'Error');
        }
    });

    // Decline Mutation
    const declineMutation = useMutation({
        mutationFn: async (weaveId: string) => {
            await declineWeave(weaveId);
            return weaveId;
        },
        onSuccess: (weaveId) => {
            logger.info('usePendingWeaves', 'Decline mutation success', { weaveId });
            showToast('Weave declined', 'Weave');
            queryClient.setQueryData(['pending-weaves'], (old: SharedWeaveData[] | undefined) =>
                old ? old.filter(w => w.id !== weaveId) : []
            );
            queryClient.invalidateQueries({ queryKey: ['pending-weaves'] });
        },
        onError: (err) => {
            logger.error('usePendingWeaves', 'Decline mutation failed', err);
            showToast('Failed to decline weave', 'Error');
        }
    });

    const refresh = useCallback(async () => {
        await refetch();
    }, [refetch]);

    return {
        pendingWeaves,
        isLoading,
        error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch weaves') : null,
        refresh,
        handleAccept: async (id) => { await acceptMutation.mutateAsync(id); },
        handleDecline: async (id) => { await declineMutation.mutateAsync(id); },
        processingId: acceptMutation.isPending ? acceptMutation.variables : (declineMutation.isPending ? declineMutation.variables : null),
    };
}
