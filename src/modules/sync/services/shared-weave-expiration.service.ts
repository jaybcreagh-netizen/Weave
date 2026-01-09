/**
 * SharedWeaveExpirationService
 * 
 * Handles expiration of pending shared weaves after 90 days.
 * - Marks local SharedWeaveRef as 'expired'
 * - For sender: reverts weave to solo (removes shared pending status)
 * - For recipient: removes from pending list
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';
import { logger } from '@/shared/services/logger.service';

const EXPIRATION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate the expiration cutoff timestamp (90 days ago)
 */
function getExpirationCutoff(): number {
    return Date.now() - (EXPIRATION_DAYS * MS_PER_DAY);
}

/**
 * Check if a shared weave has expired based on its sharedAt timestamp
 */
export function isExpired(sharedAt: number): boolean {
    return sharedAt < getExpirationCutoff();
}

/**
 * Process all pending SharedWeaveRefs and expire those older than 90 days.
 * 
 * @returns Number of weaves expired
 */
export async function expirePendingSharedWeaves(): Promise<number> {
    const cutoff = getExpirationCutoff();

    try {
        // Find all pending SharedWeaveRefs older than cutoff
        const pendingRefs = await database
            .get<SharedWeaveRef>('shared_weave_refs')
            .query(
                Q.where('status', 'pending'),
                Q.where('shared_at', Q.lt(cutoff))
            )
            .fetch();

        if (pendingRefs.length === 0) {
            logger.debug('SharedWeaveExpiration', 'No expired pending weaves found');
            return 0;
        }

        logger.info('SharedWeaveExpiration', `Found ${pendingRefs.length} expired pending weaves`);

        // Batch update all to 'expired' status
        await database.write(async () => {
            const updates = pendingRefs.map(ref =>
                ref.prepareUpdate(record => {
                    record.status = 'expired';
                    record.respondedAt = Date.now(); // Mark when expired
                })
            );
            await database.batch(...updates);
        });

        logger.info('SharedWeaveExpiration', `Expired ${pendingRefs.length} pending shared weaves`);
        return pendingRefs.length;

    } catch (error) {
        logger.error('SharedWeaveExpiration', 'Failed to expire pending weaves:', error);
        throw error;
    }
}

/**
 * Get statistics about expired weaves for debugging/monitoring
 */
export async function getExpirationStats(): Promise<{
    pendingCount: number;
    expiredCount: number;
    oldestPendingDays: number | null;
}> {
    try {
        const allRefs = await database
            .get<SharedWeaveRef>('shared_weave_refs')
            .query()
            .fetch();

        const pending = allRefs.filter(r => r.status === 'pending');
        const expired = allRefs.filter(r => r.status === 'expired');

        let oldestPendingDays: number | null = null;
        if (pending.length > 0) {
            const oldestSharedAt = Math.min(...pending.map(r => r.sharedAt));
            oldestPendingDays = Math.floor((Date.now() - oldestSharedAt) / MS_PER_DAY);
        }

        return {
            pendingCount: pending.length,
            expiredCount: expired.length,
            oldestPendingDays
        };
    } catch (error) {
        logger.error('SharedWeaveExpiration', 'Failed to get stats:', error);
        return { pendingCount: 0, expiredCount: 0, oldestPendingDays: null };
    }
}

/**
 * Run expiration check on app startup.
 * Call this from AppProviders or app initialization.
 */
export async function runExpirationCheckOnStartup(): Promise<void> {
    try {
        const expiredCount = await expirePendingSharedWeaves();
        if (expiredCount > 0) {
            logger.info('SharedWeaveExpiration', `Startup check: expired ${expiredCount} weaves`);
        }
    } catch (error) {
        // Don't crash the app if expiration fails
        logger.warn('SharedWeaveExpiration', 'Startup expiration check failed:', error);
    }
}
