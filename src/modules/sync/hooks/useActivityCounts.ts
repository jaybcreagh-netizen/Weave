/**
 * useActivityCounts Hook
 * 
 * Centralized logic for counting pending activities (link requests + shared weaves).
 * Used by Dashboard and Settings to show badges.
 */

import { useState, useEffect } from 'react';
import { usePendingWeaves } from './usePendingWeaves';
import { getPendingRequestCount } from '@/modules/relationships/services/friend-linking.service';
import { FeatureFlags } from '@/shared/config/feature-flags';

interface ActivityCounts {
    pendingRequestCount: number;
    pendingWeaveCount: number;
    totalPendingCount: number;
    refreshCounts: () => Promise<void>;
}

export function useActivityCounts(): ActivityCounts {
    const [pendingRequestCount, setPendingRequestCount] = useState(0);

    // Get pending weaves
    const { pendingWeaves, refresh: refreshWeaves } = usePendingWeaves();

    const pendingWeaveCount = FeatureFlags.ACCOUNTS_ENABLED
        ? pendingWeaves.filter(w => w.status === 'pending').length
        : 0;

    // Function to fetch request counts
    const fetchRequestCounts = async () => {
        if (!FeatureFlags.ACCOUNTS_ENABLED) return;
        try {
            const count = await getPendingRequestCount();
            setPendingRequestCount(count);
        } catch (error) {
            console.error('Failed to fetch pending request count:', error);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchRequestCounts();
    }, []);

    // Combine refresh
    const refreshCounts = async () => {
        await Promise.all([
            fetchRequestCounts(),
            refreshWeaves()
        ]);
    };

    const totalPendingCount = pendingRequestCount + pendingWeaveCount;

    return {
        pendingRequestCount,
        pendingWeaveCount,
        totalPendingCount,
        refreshCounts
    };
}
