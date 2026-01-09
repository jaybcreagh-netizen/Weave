import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from '@/db'
import { getSupabaseClient } from '@/shared/services/supabase-client';
import Logger from '@/shared/utils/Logger'

export async function sync() {
    const supabase = getSupabaseClient();
    if (!supabase) {
        Logger.warn('Sync skipped: Supabase not configured');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        Logger.warn('Sync skipped: No active session');
        return;
    }

    // NOTE: Removed explicit refreshSession() here to prevent infinite loop
    // SyncOrchestrator listens to TOKEN_REFRESHED and triggers sync, so calling it here creates a feedback loop.
    // The orchestration layer should ensure we have a valid session before calling sync().

    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            Logger.debug('📥 Pulling changes...', { lastPulledAt })

            // DEBUG PROBE: Manual fetch to see raw error response - REMOVED
            // The orchestration layer should ensure we have a valid session before calling sync().

            // The orchestration layer should ensure we have a valid session before calling sync().

            const { data, error } = await supabase.functions.invoke('sync-pull', {
                body: { lastPulledAt, schemaVersion, migration },
            })

            if (error) {
                Logger.error('Sync Pull Error:', error)
                if ((error as any).context) {
                    Logger.error('Sync Pull context:', (error as any).context)
                }
                throw new Error(error.message)
            }

            if (!data) {
                Logger.warn('Sync Pull returned no data')
                throw new Error('Sync Pull returned no data')
            }

            return {
                changes: data.changes,
                timestamp: data.timestamp
            }
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
            Logger.debug('📤 Pushing changes...', { count: Object.keys(changes).length })

            const { error } = await supabase.functions.invoke('sync-push', {
                body: { changes, lastPulledAt },
            })

            if (error) {
                Logger.error('Sync Push Error:', error)
                throw new Error(error.message)
            }
        },
        migrationsEnabledAtVersion: 8,
    })
}
