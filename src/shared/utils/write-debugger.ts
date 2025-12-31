/**
 * Database Write Queue Debugger
 * Tracks all database.write() calls to identify queue congestion issues.
 * 
 * Usage: Import and call enableWriteDebugging() at app startup to enable.
 * Disable in production by not calling it.
 */

import { database } from '@/db';
import Logger from '@/shared/utils/Logger';

let writeId = 0;
let activeWrites: Map<number, { name: string; startTime: number }> = new Map();

/**
 * Wraps a write operation with debugging information.
 * Use this instead of database.write() to track write performance.
 * 
 * @param name Human-readable name for the write operation
 * @param writeFn The async function to execute inside database.write()
 */
export async function trackedWrite<T>(
    name: string,
    writeFn: () => Promise<T>
): Promise<T> {
    const id = ++writeId;
    const queueTime = Date.now();

    Logger.debug(`[DB Write #${id}] QUEUED: "${name}" (${activeWrites.size} active writes)`);

    const result = await database.write(async () => {
        const startTime = Date.now();
        const waitTime = startTime - queueTime;

        activeWrites.set(id, { name, startTime });
        Logger.info(`[DB Write #${id}] STARTED: "${name}" (waited ${waitTime}ms in queue)`);

        try {
            const innerResult = await writeFn();
            const execTime = Date.now() - startTime;
            Logger.info(`[DB Write #${id}] COMPLETED: "${name}" (exec: ${execTime}ms, total: ${execTime + waitTime}ms)`);
            return innerResult;
        } finally {
            activeWrites.delete(id);
        }
    });

    return result;
}

/**
 * Log current write queue status
 */
export function logWriteQueueStatus(): void {
    Logger.info(`[DB Write Queue] Active writes: ${activeWrites.size}`);
    activeWrites.forEach((write, id) => {
        const elapsed = Date.now() - write.startTime;
        Logger.info(`  - #${id}: "${write.name}" (running for ${elapsed}ms)`);
    });
}
