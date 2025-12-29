/**
 * SyncQueueItem Model
 * 
 * Offline operation queue for eventual consistency.
 * Stores operations to sync when online.
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export type SyncOperationType =
    | 'share_weave'
    | 'accept_weave'
    | 'decline_weave'
    | 'update_shared_weave'
    | 'send_link_request'
    | 'accept_link_request'
    | 'decline_link_request'

export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed'

export default class SyncQueueItem extends Model {
    static table = 'sync_queue'

    // Type of operation to perform
    @text('operation_type') operationType!: SyncOperationType

    // JSON serialized operation payload
    @text('payload') payload!: string

    // Current status
    @text('status') status!: SyncStatus

    // Number of failed retry attempts
    @field('retry_count') retryCount!: number

    // Last error message (if failed)
    @text('last_error') lastError?: string

    // When this was queued
    @field('queued_at') queuedAt!: number

    // When this was processed (completed or permanently failed)
    @field('processed_at') processedAt?: number

    // Timestamps
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date

    // Helper to parse payload
    getParsedPayload<T>(): T {
        return JSON.parse(this.payload) as T
    }
}
