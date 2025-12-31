/**
 * Write Scheduler - Priority-based database write management
 * 
 * Solves the WatermelonDB single-threaded writer queue bottleneck by:
 * 1. Categorizing writes by priority (critical, important, background)
 * 2. Ensuring user-initiated actions always have queue priority
 * 3. Deferring background operations to avoid contention
 * 
 * Usage:
 *   import { writeScheduler } from '@/shared/services/write-scheduler';
 * 
 *   // Critical - user action, immediate execution
 *   await writeScheduler.critical('logWeave', async () => {
 *     await database.batch(ops);
 *   });
 * 
 *   // Background - can wait, non-blocking
 *   writeScheduler.background('Intelligence:scoring', async () => {
 *     await database.batch(scoringOps);
 *   });
 */

import { database } from '@/db';
import Logger from '@/shared/utils/Logger';
import { InteractionManager } from 'react-native';

export type WritePriority = 'critical' | 'important' | 'background';

interface ScheduledWrite<T = any> {
    id: number;
    name: string;
    priority: WritePriority;
    fn: () => Promise<T>;
    queuedAt: number;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

interface WriteStats {
    totalWrites: number;
    criticalWrites: number;
    importantWrites: number;
    backgroundWrites: number;
    avgQueueWait: number;
    avgExecTime: number;
    longestQueueWait: number;
}

class WriteSchedulerService {
    private queue: ScheduledWrite[] = [];
    private isProcessing = false;
    private writeId = 0;
    private pendingBackgroundTimeout: NodeJS.Timeout | null = null;

    // Configurable delays
    private readonly IMPORTANT_DELAY_MS = 50;    // Short delay for important writes
    private readonly BACKGROUND_DELAY_MS = 500;  // Longer delay for background writes
    private readonly BACKGROUND_BATCH_WINDOW_MS = 100; // Batch background writes within this window

    // Stats tracking
    private stats: WriteStats = {
        totalWrites: 0,
        criticalWrites: 0,
        importantWrites: 0,
        backgroundWrites: 0,
        avgQueueWait: 0,
        avgExecTime: 0,
        longestQueueWait: 0,
    };

    /**
     * Schedule a critical write - executes immediately, jumps to front of queue
     * Use for: User-initiated actions with immediate feedback expected
     */
    async critical<T>(name: string, fn: () => Promise<T>): Promise<T> {
        return this.schedule(name, 'critical', fn);
    }

    /**
     * Schedule an important write - short delay, can queue briefly
     * Use for: User actions where slight delay is acceptable
     */
    async important<T>(name: string, fn: () => Promise<T>): Promise<T> {
        return this.schedule(name, 'important', fn);
    }

    /**
     * Schedule a background write - deferred, non-blocking
     * Use for: System operations that don't need immediate execution
     * Returns immediately, write happens later
     */
    background<T>(name: string, fn: () => Promise<T>): Promise<T> {
        return this.schedule(name, 'background', fn);
    }

    /**
     * Core scheduling logic
     */
    private async schedule<T>(
        name: string,
        priority: WritePriority,
        fn: () => Promise<T>
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const write: ScheduledWrite<T> = {
                id: ++this.writeId,
                name,
                priority,
                fn,
                queuedAt: Date.now(),
                resolve,
                reject,
            };

            // Insert based on priority
            if (priority === 'critical') {
                // Critical goes to front of queue, after any currently processing
                const insertIndex = this.queue.findIndex(w => w.priority !== 'critical');
                if (insertIndex === -1) {
                    this.queue.push(write);
                } else {
                    this.queue.splice(insertIndex, 0, write);
                }
                Logger.debug(`[WriteScheduler] #${write.id} QUEUED: "${name}" (critical, queue: ${this.queue.length})`);
                this.processQueue(); // Start immediately

            } else if (priority === 'important') {
                // Important after critical, before background
                const bgIndex = this.queue.findIndex(w => w.priority === 'background');
                if (bgIndex === -1) {
                    this.queue.push(write);
                } else {
                    this.queue.splice(bgIndex, 0, write);
                }
                Logger.debug(`[WriteScheduler] #${write.id} QUEUED: "${name}" (important, queue: ${this.queue.length})`);
                setTimeout(() => this.processQueue(), this.IMPORTANT_DELAY_MS);

            } else {
                // Background at end, batched with other background writes
                this.queue.push(write);
                Logger.debug(`[WriteScheduler] #${write.id} QUEUED: "${name}" (background, queue: ${this.queue.length})`);

                // Use InteractionManager to defer until after UI interactions
                InteractionManager.runAfterInteractions(() => {
                    // Batch multiple background writes together
                    if (this.pendingBackgroundTimeout) {
                        clearTimeout(this.pendingBackgroundTimeout);
                    }
                    this.pendingBackgroundTimeout = setTimeout(() => {
                        this.pendingBackgroundTimeout = null;
                        this.processQueue();
                    }, this.BACKGROUND_BATCH_WINDOW_MS);
                });
            }
        });
    }

    /**
     * Process the write queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const write = this.queue.shift()!;
        const queueWait = Date.now() - write.queuedAt;

        Logger.info(`[WriteScheduler] #${write.id} STARTED: "${write.name}" (waited ${queueWait}ms)`);

        // Update stats
        this.updateStats(write.priority, queueWait, 0);

        const execStart = Date.now();

        try {
            const result = await database.write(async () => {
                return await write.fn();
            });

            const execTime = Date.now() - execStart;
            Logger.info(`[WriteScheduler] #${write.id} COMPLETED: "${write.name}" (exec: ${execTime}ms, total: ${queueWait + execTime}ms)`);

            // Update stats with exec time
            this.stats.avgExecTime = (this.stats.avgExecTime * (this.stats.totalWrites - 1) + execTime) / this.stats.totalWrites;

            write.resolve(result);
        } catch (error) {
            Logger.error(`[WriteScheduler] #${write.id} FAILED: "${write.name}"`, error);
            write.reject(error);
        } finally {
            this.isProcessing = false;

            // Process next item if queue not empty
            if (this.queue.length > 0) {
                // Small yield to allow other operations
                setImmediate(() => this.processQueue());
            }
        }
    }

    /**
     * Update statistics
     */
    private updateStats(priority: WritePriority, queueWait: number, execTime: number): void {
        this.stats.totalWrites++;

        if (priority === 'critical') this.stats.criticalWrites++;
        else if (priority === 'important') this.stats.importantWrites++;
        else this.stats.backgroundWrites++;

        // Running average for queue wait
        this.stats.avgQueueWait = (this.stats.avgQueueWait * (this.stats.totalWrites - 1) + queueWait) / this.stats.totalWrites;

        // Track longest wait
        if (queueWait > this.stats.longestQueueWait) {
            this.stats.longestQueueWait = queueWait;
        }
    }

    /**
     * Get current queue status
     */
    getQueueStatus(): { pending: number; byPriority: Record<WritePriority, number> } {
        const byPriority = {
            critical: this.queue.filter(w => w.priority === 'critical').length,
            important: this.queue.filter(w => w.priority === 'important').length,
            background: this.queue.filter(w => w.priority === 'background').length,
        };

        return {
            pending: this.queue.length,
            byPriority,
        };
    }

    /**
     * Get write statistics
     */
    getStats(): WriteStats {
        return { ...this.stats };
    }

    /**
     * Reset statistics (useful for debugging)
     */
    resetStats(): void {
        this.stats = {
            totalWrites: 0,
            criticalWrites: 0,
            importantWrites: 0,
            backgroundWrites: 0,
            avgQueueWait: 0,
            avgExecTime: 0,
            longestQueueWait: 0,
        };
    }

    /**
     * Log current status (for debugging)
     */
    logStatus(): void {
        const status = this.getQueueStatus();
        const stats = this.getStats();

        Logger.info('[WriteScheduler] Status:', {
            pending: status.pending,
            byPriority: status.byPriority,
            stats: {
                total: stats.totalWrites,
                avgWait: `${stats.avgQueueWait.toFixed(0)}ms`,
                avgExec: `${stats.avgExecTime.toFixed(0)}ms`,
                longestWait: `${stats.longestQueueWait}ms`,
            },
        });
    }
}

// Singleton instance
export const writeScheduler = new WriteSchedulerService();
