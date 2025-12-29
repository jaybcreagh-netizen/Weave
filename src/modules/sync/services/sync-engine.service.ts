/**
 * Sync Engine Service
 * 
 * Offline-first sync engine that processes queued operations when online.
 * Handles retry logic with exponential backoff.
 */

import { database } from '@/db';
import SyncQueueItem, { SyncOperationType, SyncStatus } from '@/db/models/SyncQueueItem';
import { Q } from '@nozbe/watermelondb';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import * as Network from 'expo-network';

// Configuration
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// Singleton state
let isProcessing = false;
let processingPromise: Promise<void> | null = null;

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(retryCount: number): number {
    return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryCount));
}

/**
 * Enqueue an operation for sync
 * This is the primary entry point for adding operations to the queue
 */
export async function enqueueOperation(
    operationType: SyncOperationType,
    payload: Record<string, unknown>
): Promise<string> {
    const queueCollection = database.get<SyncQueueItem>('sync_queue');

    let itemId = '';

    await database.write(async () => {
        const item = await queueCollection.create(record => {
            record.operationType = operationType;
            record.payload = JSON.stringify(payload);
            record.status = 'pending';
            record.retryCount = 0;
            record.queuedAt = Date.now();
        });
        itemId = item.id;
    });

    logger.info('SyncEngine', `Enqueued operation: ${operationType}`, { itemId });

    // Trigger processing in background
    startProcessing();

    return itemId;
}

/**
 * Start processing the queue (non-blocking)
 * Safe to call multiple times - only one processor runs at a time
 */
export function startProcessing(): void {
    if (isProcessing) {
        return;
    }

    // Fire and forget
    processQueue().catch(error => {
        logger.error('SyncEngine', 'Queue processing failed:', error);
    });
}

/**
 * Process all pending queue items
 */
export async function processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (isProcessing) {
        return processingPromise || Promise.resolve();
    }

    isProcessing = true;

    processingPromise = (async () => {
        try {
            // Check network connectivity
            const netState = await Network.getNetworkStateAsync();
            if (!netState.isConnected) {
                logger.info('SyncEngine', 'Offline - skipping queue processing');
                return;
            }

            // Check if Supabase client is available
            const client = getSupabaseClient();
            if (!client) {
                logger.warn('SyncEngine', 'No Supabase client - skipping queue processing');
                return;
            }

            // Fetch pending items
            const queueCollection = database.get<SyncQueueItem>('sync_queue');
            const pendingItems = await queueCollection
                .query(Q.where('status', 'pending'), Q.sortBy('queued_at', Q.asc))
                .fetch();

            if (pendingItems.length === 0) {
                logger.debug('SyncEngine', 'No pending items to process');
                return;
            }

            logger.info('SyncEngine', `Processing ${pendingItems.length} pending items`);

            // Process each item
            for (const item of pendingItems) {
                await processItem(item);
            }

        } finally {
            isProcessing = false;
            processingPromise = null;
        }
    })();

    return processingPromise;
}

/**
 * Process a single queue item
 */
async function processItem(item: SyncQueueItem): Promise<void> {
    // Check if we should wait (backoff)
    if (item.retryCount > 0) {
        const delay = getBackoffDelay(item.retryCount - 1);
        const timeSinceLastAttempt = Date.now() - (item.processedAt || item.queuedAt);

        if (timeSinceLastAttempt < delay) {
            logger.debug('SyncEngine', `Skipping ${item.id} - backoff not elapsed`);
            return;
        }
    }

    // Mark as processing
    await database.write(async () => {
        await item.update(record => {
            record.status = 'processing';
        });
    });

    try {
        // Execute the operation
        await executeOperation(item.operationType, item.getParsedPayload<Record<string, unknown>>());

        // Success - mark as completed
        await database.write(async () => {
            await item.update(record => {
                record.status = 'completed';
                record.processedAt = Date.now();
            });
        });

        logger.info('SyncEngine', `Completed: ${item.operationType}`, { itemId: item.id });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newRetryCount = item.retryCount + 1;

        logger.warn('SyncEngine', `Failed: ${item.operationType}`, {
            itemId: item.id,
            retryCount: newRetryCount,
            error: errorMessage
        });

        // Update with failure info
        await database.write(async () => {
            await item.update(record => {
                record.retryCount = newRetryCount;
                record.lastError = errorMessage;
                record.processedAt = Date.now();

                // Permanent failure if max retries exceeded
                if (newRetryCount >= MAX_RETRIES) {
                    record.status = 'failed';
                } else {
                    record.status = 'pending'; // Back to pending for retry
                }
            });
        });
    }
}

/**
 * Execute an operation against Supabase
 */
async function executeOperation(
    operationType: SyncOperationType,
    payload: Record<string, unknown>
): Promise<void> {
    const { executeShareWeave, executeAcceptWeave, executeDeclineWeave, executeUpdateSharedWeave } = await import('./sync-operations');

    switch (operationType) {
        case 'share_weave':
            await executeShareWeave(payload);
            break;
        case 'accept_weave':
            await executeAcceptWeave(payload);
            break;
        case 'decline_weave':
            await executeDeclineWeave(payload);
            break;
        case 'update_shared_weave':
            await executeUpdateSharedWeave(payload);
            break;
        case 'send_link_request':
        case 'accept_link_request':
        case 'decline_link_request':
            // These are handled by friend-linking.service.ts directly for now
            logger.warn('SyncEngine', `Operation ${operationType} should be handled by friend-linking service`);
            break;
        default:
            throw new Error(`Unknown operation type: ${operationType}`);
    }
}

/**
 * Get counts of items by status
 */
export async function getQueueStats(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    completed: number;
}> {
    const queueCollection = database.get<SyncQueueItem>('sync_queue');

    const [pending, processing, failed, completed] = await Promise.all([
        queueCollection.query(Q.where('status', 'pending')).fetchCount(),
        queueCollection.query(Q.where('status', 'processing')).fetchCount(),
        queueCollection.query(Q.where('status', 'failed')).fetchCount(),
        queueCollection.query(Q.where('status', 'completed')).fetchCount(),
    ]);

    return { pending, processing, failed, completed };
}

/**
 * Retry all failed items
 */
export async function retryFailed(): Promise<void> {
    const queueCollection = database.get<SyncQueueItem>('sync_queue');
    const failedItems = await queueCollection
        .query(Q.where('status', 'failed'))
        .fetch();

    if (failedItems.length === 0) {
        return;
    }

    await database.write(async () => {
        const updates = failedItems.map(item =>
            item.prepareUpdate(record => {
                record.status = 'pending';
                record.retryCount = 0;
                record.lastError = undefined;
            })
        );
        await database.batch(...updates);
    });

    logger.info('SyncEngine', `Reset ${failedItems.length} failed items for retry`);

    startProcessing();
}

/**
 * Clear completed items older than specified age
 */
export async function clearOldCompleted(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    const queueCollection = database.get<SyncQueueItem>('sync_queue');

    const oldItems = await queueCollection
        .query(
            Q.where('status', 'completed'),
            Q.where('processed_at', Q.lt(cutoff))
        )
        .fetch();

    if (oldItems.length === 0) {
        return;
    }

    await database.write(async () => {
        const deletes = oldItems.map(item => item.prepareDestroyPermanently());
        await database.batch(...deletes);
    });

    logger.info('SyncEngine', `Cleared ${oldItems.length} old completed items`);
}
