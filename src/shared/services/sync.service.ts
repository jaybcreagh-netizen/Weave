import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from '@/db'
import { supabase } from '@/modules/auth';
import Logger from '@/shared/utils/Logger'

export async function sync() {
    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            Logger.debug('📥 Pulling changes...', { lastPulledAt })

            const { data, error } = await supabase.functions.invoke('sync-pull', {
                body: { lastPulledAt, schemaVersion, migration }
            })

            if (error) {
                Logger.error('Sync Pull Error:', error)
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
                body: { changes, lastPulledAt }
            })

            if (error) {
                Logger.error('Sync Push Error:', error)
                throw new Error(error.message)
            }
        },
        migrationsEnabledAtVersion: 1,
    })
}
