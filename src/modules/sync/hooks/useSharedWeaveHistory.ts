/**
 * useSharedWeaveHistory Hook
 * 
 * Hook to fetch and manage shared weave history (accepted/declined).
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchSharedWeaveHistory } from '../services/receive-weave.service';
import { SharedWeaveData } from '../components/SharedWeaveCard';
import { logger } from '@/shared/services/logger.service';

interface UseSharedWeaveHistoryReturn {
    historyWeaves: SharedWeaveData[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useSharedWeaveHistory(): UseSharedWeaveHistoryReturn {
    const [historyWeaves, setHistoryWeaves] = useState<SharedWeaveData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const weaves = await fetchSharedWeaveHistory();

            // Transform to SharedWeaveData format
            const formattedWeaves: SharedWeaveData[] = weaves.map(w => ({
                id: w.id,
                creatorName: w.creatorName,
                weaveDate: new Date(w.weaveDate),
                title: w.title,
                location: w.location,
                category: w.category,
                duration: w.duration,
                status: w.status,
                sharedAt: new Date(w.weaveDate), // Using weave date as specific sharedAt is not critical for history
            }));

            setHistoryWeaves(formattedWeaves);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch weave history';
            setError(message);
            logger.error('useHistoryWeaves', 'Refresh failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        historyWeaves,
        isLoading,
        error,
        refresh,
    };
}
