import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { sync } from '@/shared/services/sync.service';
import { supabase } from '@/modules/auth/services/supabase.service';
import Logger from '@/shared/utils/Logger';
import { useSyncStatusStore } from '../store/sync-status.store';

class SyncOrchestratorService {
    private lastSyncTime = 0;
    private readonly DEBOUNCE_MS = 5000;
    private readonly PERIODIC_MS = 15 * 60 * 1000; // 15 minutes
    private periodicInterval: NodeJS.Timeout | null = null;
    private isSyncing = false;

    initialize() {
        Logger.info('[SyncOrchestrator] Initializing...');

        // 1. Setup AppState listener for foreground syncs
        this.setupAppStateListener();

        // 2. Setup periodic sync
        this.setupPeriodicSync();

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

    private setupPeriodicSync() {
        if (this.periodicInterval) {
            clearInterval(this.periodicInterval);
        }

        this.periodicInterval = setInterval(() => {
            this.triggerSync('periodic');
        }, this.PERIODIC_MS);
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
