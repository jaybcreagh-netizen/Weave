/**
 * useSyncStatus Hook
 * 
 * Reactive hook for sync queue status.
 */

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/db';
import SyncQueueItem from '@/db/models/SyncQueueItem';
import { Q } from '@nozbe/watermelondb';

interface SyncStatus {
    pendingCount: number;
    processingCount: number;
    failedCount: number;
    isProcessing: boolean;
    lastSyncTime: Date | null;
}

/**
 * Hook to observe sync queue status
 */
export function useSyncStatus(): SyncStatus {
    const [status, setStatus] = useState<SyncStatus>({
        pendingCount: 0,
        processingCount: 0,
        failedCount: 0,
        isProcessing: false,
        lastSyncTime: null,
    });

    const refreshStatus = useCallback(async () => {
        const queueCollection = database.get<SyncQueueItem>('sync_queue');

        try {
            const [pending, processing, failed] = await Promise.all([
                queueCollection.query(Q.where('status', 'pending')).fetchCount(),
                queueCollection.query(Q.where('status', 'processing')).fetchCount(),
                queueCollection.query(Q.where('status', 'failed')).fetchCount(),
            ]);

            // Get most recent completed item for last sync time
            const completedItems = await queueCollection
                .query(
                    Q.where('status', 'completed'),
                    Q.sortBy('processed_at', Q.desc),
                    Q.take(1)
                )
                .fetch();

            const lastSyncTime = completedItems.length > 0 && completedItems[0].processedAt
                ? new Date(completedItems[0].processedAt)
                : null;

            setStatus({
                pendingCount: pending,
                processingCount: processing,
                failedCount: failed,
                isProcessing: processing > 0,
                lastSyncTime,
            });
        } catch (error) {
            console.error('[useSyncStatus] Error fetching status:', error);
        }
    }, []);

    useEffect(() => {
        refreshStatus();

        // Subscribe to changes in sync_queue
        const queueCollection = database.get<SyncQueueItem>('sync_queue');
        const subscription = queueCollection
            .query()
            .observe()
            .subscribe(() => {
                refreshStatus();
            });

        return () => subscription.unsubscribe();
    }, [refreshStatus]);

    return status;
}
