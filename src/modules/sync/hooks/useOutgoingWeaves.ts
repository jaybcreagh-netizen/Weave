/**
 * useOutgoingWeaves
 * 
 * Hook to fetch outgoing shared weaves (weaves the user has sent).
 * Combines local SharedWeaveRef data with SyncQueueItem status for pending/failed items.
 */

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import SyncQueueItem from '@/db/models/SyncQueueItem';
import Interaction from '@/db/models/Interaction';
import { logger } from '@/shared/services/logger.service';
import { retryFailed, retryPending, getQueueStats } from '../services/action-queue.service';

export interface OutgoingWeave {
    id: string; // SharedWeaveRef id or SyncQueueItem id
    interactionId: string;
    title?: string;
    category?: string;
    weaveDate?: Date;
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    serverWeaveId?: string;
    sharedAt: number;
    error?: string;
    queueItemId?: string; // For retry
}

export function useOutgoingWeaves() {
    const [outgoingWeaves, setOutgoingWeaves] = useState<OutgoingWeave[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [failedCount, setFailedCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);

    const loadOutgoingWeaves = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Get all SharedWeaveRefs where user is creator
            const refCollection = database.get<SharedWeaveRef>('shared_weave_refs');
            const creatorRefs = await refCollection
                .query(Q.where('is_creator', true))
                .fetch();

            // 2. Get pending/processing share_weave queue items for items not yet synced
            const queueCollection = database.get<SyncQueueItem>('sync_queue');
            const pendingQueueItems = await queueCollection
                .query(
                    Q.where('operation_type', 'share_weave'),
                    Q.where('status', Q.oneOf(['pending', 'processing']))
                )
                .fetch();

            const failedQueueItems = await queueCollection
                .query(
                    Q.where('operation_type', 'share_weave'),
                    Q.where('status', 'failed')
                )
                .fetch();

            setFailedCount(failedQueueItems.length);
            setPendingCount(pendingQueueItems.length);

            console.log('[OutgoingWeaves] Queue counts:', {
                pendingQueueItems: pendingQueueItems.length,
                failedQueueItems: failedQueueItems.length,
                creatorRefs: creatorRefs.length,
            });

            // 3. Get interaction details for display
            const interactionIds = new Set([
                ...creatorRefs.map(r => r.interactionId),
                ...pendingQueueItems.map(q => {
                    try {
                        const payload = q.getParsedPayload<{ interactionId?: string }>();
                        return payload.interactionId;
                    } catch { return undefined; }
                }).filter(Boolean) as string[],
                ...failedQueueItems.map(q => {
                    try {
                        const payload = q.getParsedPayload<{ interactionId?: string }>();
                        return payload.interactionId;
                    } catch { return undefined; }
                }).filter(Boolean) as string[],
            ]);

            const interactionCollection = database.get<Interaction>('interactions');
            const interactions = await interactionCollection
                .query(Q.where('id', Q.oneOf([...interactionIds])))
                .fetch();
            const interactionMap = new Map(interactions.map(i => [i.id, i]));

            // 4. Build outgoing weaves list
            const results: OutgoingWeave[] = [];
            const processedInteractionIds = new Set<string>();

            // Add failed items first (highest priority)
            for (const item of failedQueueItems) {
                try {
                    const payload = item.getParsedPayload<{ interactionId?: string; title?: string; category?: string; weaveDate?: string }>();
                    if (!payload.interactionId) continue;

                    const interaction = interactionMap.get(payload.interactionId);
                    results.push({
                        id: item.id,
                        interactionId: payload.interactionId,
                        title: interaction?.title || payload.title,
                        category: interaction?.interactionCategory || payload.category,
                        weaveDate: interaction?.interactionDate || (payload.weaveDate ? new Date(payload.weaveDate) : undefined),
                        status: 'failed',
                        sharedAt: item.queuedAt,
                        error: item.lastError || 'Sync failed',
                        queueItemId: item.id,
                    });
                    processedInteractionIds.add(payload.interactionId);
                } catch (e) {
                    logger.warn('useOutgoingWeaves', 'Failed to parse queue item payload', e);
                }
            }

            // Add pending/processing items
            for (const item of pendingQueueItems) {
                try {
                    const payload = item.getParsedPayload<{ interactionId?: string; title?: string; category?: string; weaveDate?: string }>();
                    if (!payload.interactionId) continue;
                    if (processedInteractionIds.has(payload.interactionId)) continue;

                    const interaction = interactionMap.get(payload.interactionId);
                    results.push({
                        id: item.id,
                        interactionId: payload.interactionId,
                        title: interaction?.title || payload.title,
                        category: interaction?.interactionCategory || payload.category,
                        weaveDate: interaction?.interactionDate || (payload.weaveDate ? new Date(payload.weaveDate) : undefined),
                        status: item.status === 'processing' ? 'syncing' : 'pending',
                        sharedAt: item.queuedAt,
                        queueItemId: item.id,
                    });
                    processedInteractionIds.add(payload.interactionId);
                } catch (e) {
                    logger.warn('useOutgoingWeaves', 'Failed to parse queue item payload', e);
                }
            }

            // Add synced items from SharedWeaveRef
            for (const ref of creatorRefs) {
                if (processedInteractionIds.has(ref.interactionId)) continue;

                const interaction = interactionMap.get(ref.interactionId);
                results.push({
                    id: ref.id,
                    interactionId: ref.interactionId,
                    serverWeaveId: ref.serverWeaveId,
                    title: interaction?.title,
                    category: interaction?.interactionCategory,
                    weaveDate: interaction?.interactionDate,
                    status: ref.serverWeaveId ? 'synced' : 'pending',
                    sharedAt: ref.sharedAt,
                });
                processedInteractionIds.add(ref.interactionId);
            }

            // Sort by sharedAt descending (newest first)
            results.sort((a, b) => b.sharedAt - a.sharedAt);

            setOutgoingWeaves(results);
        } catch (e) {
            logger.error('useOutgoingWeaves', 'Failed to load outgoing weaves', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleRetryAll = useCallback(async () => {
        console.log('[OutgoingWeaves] Retrying all stuck items...');
        await retryFailed();   // Reset 'failed' items
        await retryPending();  // Reset 'pending' items with retry counts > 0
        console.log('[OutgoingWeaves] Retry complete, reloading in 1s...');
        // Reload after a short delay to allow queue to process
        setTimeout(loadOutgoingWeaves, 1000);
    }, [loadOutgoingWeaves]);

    useEffect(() => {
        loadOutgoingWeaves();
    }, [loadOutgoingWeaves]);

    return {
        outgoingWeaves,
        isLoading,
        failedCount,
        pendingCount,
        refresh: loadOutgoingWeaves,
        retryAll: handleRetryAll,
    };
}
