/**
 * LLM Request Queue
 * Manages concurrent API requests to prevent rate limiting and timeouts.
 *
 * Problem: Multiple simultaneous Gemini API calls (insights + Oracle chat)
 * can overwhelm rate limits (60 RPM on free tier) causing timeouts.
 *
 * Solution: Queue requests with concurrency control and priority system.
 */

import { logger } from '@/shared/services/logger.service'

// ============================================================================
// Types
// ============================================================================

export type RequestPriority = 'high' | 'normal' | 'low'

interface QueuedRequest<T> {
    id: string
    priority: RequestPriority
    execute: () => Promise<T>
    resolve: (value: T) => void
    reject: (error: Error) => void
    createdAt: number
    timeoutMs?: number
}

export interface QueueOptions {
    /** Request priority - 'high' for interactive, 'low' for background */
    priority?: RequestPriority
    /** Custom timeout for this request (overrides default) */
    timeoutMs?: number
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    /** Maximum concurrent requests */
    maxConcurrent: 2,

    /** Minimum delay between requests (ms) to respect rate limits */
    minDelayBetweenRequests: 200,

    /** Default timeout per request (ms) */
    defaultTimeoutMs: 45000,

    /** How long before a queued request expires (ms) */
    queueExpiryMs: 60000,
}

// ============================================================================
// Request Queue Class
// ============================================================================

class LLMRequestQueue {
    private queue: QueuedRequest<unknown>[] = []
    private activeRequests = 0
    private lastRequestTime = 0
    private requestCounter = 0
    private isProcessing = false

    /**
     * Enqueue a request with priority handling
     */
    async enqueue<T>(
        execute: () => Promise<T>,
        options: QueueOptions = {}
    ): Promise<T> {
        const { priority = 'normal', timeoutMs } = options

        return new Promise<T>((resolve, reject) => {
            const request: QueuedRequest<T> = {
                id: `req_${++this.requestCounter}`,
                priority,
                execute,
                resolve: resolve as (value: unknown) => void,
                reject,
                createdAt: Date.now(),
                timeoutMs,
            }

            // Insert based on priority
            this.insertByPriority(request as QueuedRequest<unknown>)

            logger.debug('LLMRequestQueue', `Enqueued ${request.id} (${priority}), queue size: ${this.queue.length}`)

            // Start processing if not already
            this.processQueue()
        })
    }

    /**
     * Insert request in queue based on priority
     * High priority goes to front, low to back
     */
    private insertByPriority(request: QueuedRequest<unknown>): void {
        if (request.priority === 'high') {
            // Find first non-high priority request and insert before it
            const idx = this.queue.findIndex(r => r.priority !== 'high')
            if (idx === -1) {
                this.queue.push(request)
            } else {
                this.queue.splice(idx, 0, request)
            }
        } else if (request.priority === 'low') {
            // Always add to end
            this.queue.push(request)
        } else {
            // Normal priority: add after high, before low
            const idx = this.queue.findIndex(r => r.priority === 'low')
            if (idx === -1) {
                this.queue.push(request)
            } else {
                this.queue.splice(idx, 0, request)
            }
        }
    }

    /**
     * Process queued requests respecting concurrency limits
     */
    private async processQueue(): Promise<void> {
        // Prevent multiple processing loops
        if (this.isProcessing) return
        this.isProcessing = true

        try {
            while (this.queue.length > 0 && this.activeRequests < CONFIG.maxConcurrent) {
                // Clean up expired requests first
                this.removeExpiredRequests()

                if (this.queue.length === 0) break

                // Respect minimum delay between requests
                const timeSinceLastRequest = Date.now() - this.lastRequestTime
                if (timeSinceLastRequest < CONFIG.minDelayBetweenRequests) {
                    const delay = CONFIG.minDelayBetweenRequests - timeSinceLastRequest
                    await this.sleep(delay)
                }

                const request = this.queue.shift()
                if (!request) continue

                // Execute request (don't await, let it run concurrently)
                this.executeRequest(request)
            }
        } finally {
            this.isProcessing = false
        }
    }

    /**
     * Execute a single request with timeout handling
     */
    private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
        this.activeRequests++
        this.lastRequestTime = Date.now()

        const timeoutMs = request.timeoutMs || CONFIG.defaultTimeoutMs

        logger.debug('LLMRequestQueue', `Executing ${request.id}, active: ${this.activeRequests}`)

        try {
            // Race between execution and timeout
            const result = await Promise.race([
                request.execute(),
                this.createTimeout(timeoutMs, request.id),
            ])

            request.resolve(result as T)
            logger.debug('LLMRequestQueue', `Completed ${request.id}`)
        } catch (error) {
            logger.warn('LLMRequestQueue', `Failed ${request.id}: ${(error as Error).message}`)
            request.reject(error as Error)
        } finally {
            this.activeRequests--
            // Continue processing queue
            this.processQueue()
        }
    }

    /**
     * Create a timeout promise
     */
    private createTimeout(ms: number, requestId: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request ${requestId} timed out after ${ms}ms`))
            }, ms)
        })
    }

    /**
     * Remove requests that have been waiting too long
     */
    private removeExpiredRequests(): void {
        const now = Date.now()
        const expired = this.queue.filter(
            r => now - r.createdAt > CONFIG.queueExpiryMs
        )

        for (const request of expired) {
            const idx = this.queue.indexOf(request)
            if (idx !== -1) {
                this.queue.splice(idx, 1)
                request.reject(new Error(`Request expired after ${CONFIG.queueExpiryMs}ms in queue`))
                logger.warn('LLMRequestQueue', `Expired ${request.id}`)
            }
        }
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Get current queue stats (for debugging/UI)
     */
    getStats(): { queued: number; active: number } {
        return {
            queued: this.queue.length,
            active: this.activeRequests,
        }
    }

    /**
     * Clear all pending requests (e.g., on logout)
     */
    clear(): void {
        for (const request of this.queue) {
            request.reject(new Error('Queue cleared'))
        }
        this.queue = []
        logger.info('LLMRequestQueue', 'Queue cleared')
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const llmRequestQueue = new LLMRequestQueue()
