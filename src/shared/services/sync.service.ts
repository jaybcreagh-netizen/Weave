import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from '@/db'
import { getSupabaseClient } from '@/shared/services/supabase-client';
import Logger from '@/shared/utils/Logger'

/**
 * Error types for sync operations
 */
export type SyncErrorCode =
    | 'NETWORK_ERROR'      // Retryable - network connectivity issues
    | 'AUTH_ERROR'         // Not retryable - session invalid
    | 'SERVER_ERROR'       // Retryable - 5xx server errors
    | 'CLIENT_ERROR'       // Not retryable - 4xx client errors
    | 'TIMEOUT'            // Retryable - request timed out
    | 'NO_DATA'            // Retryable - server returned empty response
    | 'UNKNOWN';           // Unknown error

export class SyncError extends Error {
    code: SyncErrorCode;
    originalError?: Error;
    retryable: boolean;

    constructor(message: string, code: SyncErrorCode, originalError?: Error) {
        super(message);
        this.name = 'SyncError';
        this.code = code;
        this.originalError = originalError;
        this.retryable = ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT', 'NO_DATA'].includes(code);
    }
}

/**
 * Classify an error into a SyncErrorCode
 */
function classifyError(error: any): SyncErrorCode {
    const message = (error?.message || '').toLowerCase();

    // Network errors
    if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connection') ||
        message.includes('socket') ||
        error?.code === 'NETWORK_ERROR'
    ) {
        return 'NETWORK_ERROR';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
        return 'TIMEOUT';
    }

    // Auth errors (401, 403)
    if (
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('jwt') ||
        message.includes('token') ||
        error?.status === 401 ||
        error?.status === 403
    ) {
        return 'AUTH_ERROR';
    }

    // Server errors (5xx)
    if (error?.status >= 500 && error?.status < 600) {
        return 'SERVER_ERROR';
    }

    // Client errors (4xx)
    if (error?.status >= 400 && error?.status < 500) {
        return 'CLIENT_ERROR';
    }

    return 'UNKNOWN';
}

/**
 * Retry a function with exponential backoff
 * Only retries on network-related errors
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    operationName: string,
    maxAttempts = 3,
    baseDelayMs = 1000
): Promise<T> {
    let lastError: SyncError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            const errorCode = classifyError(error);
            const syncError = new SyncError(
                error?.message || `${operationName} failed`,
                errorCode,
                error instanceof Error ? error : undefined
            );

            lastError = syncError;

            // Log the error with context
            Logger.error(`[Sync] ${operationName} failed (attempt ${attempt}/${maxAttempts})`, {
                code: errorCode,
                message: error?.message,
                retryable: syncError.retryable,
                context: error?.context,
            });

            // Don't retry non-retryable errors
            if (!syncError.retryable) {
                throw syncError;
            }

            // Don't wait after the last attempt
            if (attempt === maxAttempts) {
                throw syncError;
            }

            // Exponential backoff: 1s, 2s, 4s...
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            Logger.info(`[Sync] Retrying ${operationName} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new SyncError(`${operationName} failed after ${maxAttempts} attempts`, 'UNKNOWN');
}

export async function sync() {
    const supabase = getSupabaseClient();
    if (!supabase) {
        Logger.warn('[Sync] Skipped: Supabase not configured');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        Logger.warn('[Sync] Skipped: No active session');
        return;
    }

    // NOTE: Removed explicit refreshSession() here to prevent infinite loop
    // SyncOrchestrator listens to TOKEN_REFRESHED and triggers sync, so calling it here creates a feedback loop.
    // The orchestration layer should ensure we have a valid session before calling sync().

    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            Logger.debug('[Sync] 📥 Pulling changes...', { lastPulledAt })

            return await withRetry(async () => {
                const { data, error } = await supabase.functions.invoke('sync-pull', {
                    body: { lastPulledAt, schemaVersion, migration },
                })

                if (error) {
                    // Attach context to error for better debugging
                    const enrichedError = error as any;
                    enrichedError.context = { lastPulledAt, schemaVersion };
                    throw enrichedError;
                }

                if (!data) {
                    throw new SyncError('Sync Pull returned no data', 'NO_DATA');
                }

                Logger.debug('[Sync] 📥 Pull complete', {
                    tables: Object.keys(data.changes || {}),
                    timestamp: data.timestamp
                });

                return {
                    changes: data.changes,
                    timestamp: data.timestamp
                }
            }, 'Pull', 3, 1000);
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
            const changeCount = Object.values(changes).reduce(
                (sum: number, table: any) =>
                    sum + (table.created?.length || 0) + (table.updated?.length || 0) + (table.deleted?.length || 0),
                0
            );

            if (changeCount === 0) {
                Logger.debug('[Sync] 📤 No changes to push');
                return;
            }

            Logger.debug('[Sync] 📤 Pushing changes...', { changeCount })

            return await withRetry(async () => {
                const { error } = await supabase.functions.invoke('sync-push', {
                    body: { changes, lastPulledAt },
                })

                if (error) {
                    // Attach context to error for better debugging
                    const enrichedError = error as any;
                    enrichedError.context = { changeCount, lastPulledAt };
                    throw enrichedError;
                }

                Logger.debug('[Sync] 📤 Push complete', { changeCount });
            }, 'Push', 3, 1000);
        },
        migrationsEnabledAtVersion: 8,
    })
}
