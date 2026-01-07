import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { sync } from '@/shared/services/sync.service';
import { supabase } from '@/modules/auth';
import Logger from '@/shared/utils/Logger';
import { useSyncStatusStore } from '../store/sync-status.store';

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

class SyncOrchestratorService {
    private lastSyncTime = 0;
    private readonly DEBOUNCE_MS = 5000;
    private isSyncing = false;

    initialize() {
        Logger.info('[SyncOrchestrator] Initializing...');

        // 1. Setup AppState listener for foreground syncs
        this.setupAppStateListener();

        // 2. Setup periodic background sync
        this.registerBackgroundSync();

        // 3. Trigger initial sync
        this.triggerSync('initialization');
    }

    private setupAppStateListener() {
        AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                this.triggerSync('foreground');
            }
        });
    }

    private async registerBackgroundSync() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (!isRegistered) {
                await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                    minimumInterval: 15 * 60, // 15 minutes
                    stopOnTerminate: false, // Continue even if app is closed
                    startOnBoot: true, // Android
                });
                Logger.info('[SyncOrchestrator] Background sync registered');
            }
        } catch (err) {
            Logger.error('[SyncOrchestrator] Failed to register background sync:', err);
        }
    }

    async cleanup() {
        try {
            await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
            Logger.info('[SyncOrchestrator] Background sync unregistered');
        } catch (err) {
            Logger.error('[SyncOrchestrator] Failed to unregister background sync:', err);
        }
    }

    async triggerSync(reason: string) {
        // Debounce
        if (Date.now() - this.lastSyncTime < this.DEBOUNCE_MS) {
            Logger.debug(`[SyncOrchestrator] Debouncing sync request (${reason})`);
            return;
        }

        if (this.isSyncing) {
            Logger.debug(`[SyncOrchestrator] Sync already in progress, skipping (${reason})`);
            return;
        }

        const store = useSyncStatusStore.getState();

        try {
            // Check network status
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || !networkState.isInternetReachable) {
                Logger.debug(`[SyncOrchestrator] No internet connection, skipping sync (${reason})`);
                return;
            }

            // Check if user is logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                Logger.debug(`[SyncOrchestrator] No active session, skipping sync (${reason})`);
                return;
            }

            this.isSyncing = true;
            store.setSyncing(true);
            store.setLastError(null);

            Logger.info(`[SyncOrchestrator] Starting sync (${reason})...`);

            await sync();

            this.lastSyncTime = Date.now();
            store.setLastSyncTime(this.lastSyncTime);
            Logger.info(`[SyncOrchestrator] Sync completed successfully (${reason})`);

        } catch (error: any) {
            Logger.error(`[SyncOrchestrator] Sync failed (${reason}):`, error);
            store.setLastError(error.message || 'Sync failed');
        } finally {
            this.isSyncing = false;
            store.setSyncing(false);
        }
    }
}

export const SyncOrchestrator = new SyncOrchestratorService();

// Register the task in the global scope
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        Logger.debug('[SyncOrchestrator] Background sync task firing');
        await SyncOrchestrator.triggerSync('background-fetch');
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        Logger.error('[SyncOrchestrator] Background sync task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});
