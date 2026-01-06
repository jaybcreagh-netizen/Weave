/**
 * Action Queue Service
 * 
 * Offline-first queue for sync operations (share/accept/decline weave).
 * Handles retry logic with exponential backoff.
 * 
 * NOTE: Renamed from sync-engine.service.ts for clarity.
 * This service handles the OFFLINE ACTION QUEUE for specific operations.
 * For full data replication of tables, see data-replication.service.ts
 */

import { database } from '@/db';
import SyncQueueItem, { SyncOperationType, SyncStatus } from '@/db/models/SyncQueueItem';
import { Q } from '@nozbe/watermelondb';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
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
    const serializedPayload = JSON.stringify(payload);

    // Check for duplicates
    // We fetch pending/processing items of the same type and check payload equality
    const existingItems = await queueCollection
        .query(
            Q.where('operation_type', operationType),
            Q.where('status', Q.oneOf(['pending', 'processing']))
        )
        .fetch();

    const duplicate = existingItems.find(item => item.payload === serializedPayload);

    if (duplicate) {
        logger.info('ActionQueue', `Duplicate operation detected, skipping: ${operationType}`, {
            itemId: duplicate.id,
            status: duplicate.status
        });
        return duplicate.id;
    }

    let itemId = '';

    await database.write(async () => {
        const item = await queueCollection.create(record => {
            record.operationType = operationType;
            record.payload = serializedPayload;
            record.status = 'pending';
            record.retryCount = 0;
            record.queuedAt = Date.now();
        });
        itemId = item.id;
    });

    logger.info('ActionQueue', `Enqueued operation: ${operationType}`, { itemId });

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
        logger.error('ActionQueue', 'Queue processing failed:', error);
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
    const BATCH_SIZE = 50;

    processingPromise = (async () => {
        try {
            // Check network connectivity
            const netState = await Network.getNetworkStateAsync();
            if (!netState.isConnected) {
                logger.info('ActionQueue', 'Offline - skipping queue processing');
                return;
            }

            // Check if Supabase client is available
            const client = getSupabaseClient();
            if (!client) {
                logger.warn('ActionQueue', 'No Supabase client - skipping queue processing');
                return;
            }

            const queueCollection = database.get<SyncQueueItem>('sync_queue');
            let hasMore = true;

            // Process in batches to prevent OOM on large queues
            while (hasMore) {
                const pendingItems = await queueCollection
                    .query(
                        Q.where('status', 'pending'),
                        Q.sortBy('queued_at', Q.asc),
                        Q.take(BATCH_SIZE)
                    )
                    .fetch();

                if (pendingItems.length === 0) {
                    logger.debug('ActionQueue', 'No pending items to process');
                    break;
                }

                logger.info('ActionQueue', `Processing batch of ${pendingItems.length} pending items`);

                // Process each item in the batch
                for (const item of pendingItems) {
                    await processItem(item);
                }

                // Continue if we got a full batch (more items may exist)
                hasMore = pendingItems.length === BATCH_SIZE;
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
            logger.debug('ActionQueue', `Skipping ${item.id} - backoff not elapsed`);
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

        logger.info('ActionQueue', `Completed: ${item.operationType}`, { itemId: item.id });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newRetryCount = item.retryCount + 1;

        logger.warn('ActionQueue', `Failed: ${item.operationType}`, {
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
                    // Track shared weave failures for observability
                    if (['share_weave', 'accept_weave', 'decline_weave', 'update_shared_weave'].includes(item.operationType)) {
                        trackEvent(AnalyticsEvents.SHARED_WEAVE_FAILED, {
                            operation: item.operationType,
                            error: errorMessage,
                        });
                    }
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
    const {
        executeShareWeave,
        executeAcceptWeave,
        executeDeclineWeave,
        executeUpdateSharedWeave,
        executeSendLinkRequest,
        executeAcceptLinkRequest,
        executeDeclineLinkRequest,
    } = await import('./sync-operations');

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
            await executeSendLinkRequest(payload);
            break;
        case 'accept_link_request':
            await executeAcceptLinkRequest(payload);
            break;
        case 'decline_link_request':
            await executeDeclineLinkRequest(payload);
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

    logger.info('ActionQueue', `Reset ${failedItems.length} failed items for retry`);

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

    logger.info('ActionQueue', `Cleared ${oldItems.length} old completed items`);
}
