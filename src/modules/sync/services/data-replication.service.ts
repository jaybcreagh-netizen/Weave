/**
 * Data Replication Service - Bidirectional sync between WatermelonDB and Supabase
 * Handles conflict resolution, delta sync, and offline support
 * 
 * NOTE: Renamed from SyncEngine (auth module) for clarity.
 * This service handles FULL DATA REPLICATION for tables like friends, interactions, etc.
 * For offline action queue (share/accept/decline weave), see action-queue.service.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { database } from '@/db';
import { supabase } from '@/modules/auth/services/supabase.service';
import { Q } from '@nozbe/watermelondb';
import type { Model } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { useSyncConflictStore } from '@/modules/auth/store/sync-conflict.store';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SyncConfig {
    userId: string;
    lastSyncTimestamp?: number;
}

interface SyncResult {
    success: boolean;
    pulledRecords: number;
    pushedRecords: number;
    conflicts: number;
    errors: string[];
}

/**
 * Tables to sync (in dependency order)
 */
const SYNC_TABLES = [
    'friends',
    'interactions',
    'interaction_friends',
    'intentions',
    'intention_friends',
    'user_profiles',
    'user_progress',
    'life_events',
    'weekly_reflections',
    'journal_entries',
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SyncTable = typeof SYNC_TABLES[number];

/**
 * Main data replication service class
 * Handles bidirectional sync of WatermelonDB tables to Supabase
 */
export class DataReplicationService {
    private userId: string;
    private lastSyncTimestamp: number;
    private isSyncing: boolean = false;

    constructor(userId: string) {
        this.userId = userId;
        this.lastSyncTimestamp = 0;
    }

    /**
     * Perform full bidirectional sync
     */
    async sync(): Promise<SyncResult> {
        if (this.isSyncing) {
            Logger.debug('DataReplication: Sync already in progress, skipping...');
            return {
                success: false,
                pulledRecords: 0,
                pushedRecords: 0,
                conflicts: 0,
                errors: ['Sync already in progress'],
            };
        }

        this.isSyncing = true;
        const result: SyncResult = {
            success: true,
            pulledRecords: 0,
            pushedRecords: 0,
            conflicts: 0,
            errors: [],
        };

        try {
            // Load last sync timestamp from local storage
            await this.loadLastSyncTimestamp();

            // Phase 1: Pull changes from server
            Logger.debug('DataReplication: 📥 Pulling changes from server...');
            const pullResult = await this.pullFromServer();
            result.pulledRecords = pullResult.count;
            result.conflicts += pullResult.conflicts;

            // Phase 2: Push local changes to server
            Logger.debug('DataReplication: 📤 Pushing local changes to server...');
            const pushResult = await this.pushToServer();
            result.pushedRecords = pushResult.count;

            // Update last sync timestamp
            this.lastSyncTimestamp = Date.now();
            await this.saveLastSyncTimestamp();

            Logger.info('DataReplication: ✅ Sync completed successfully', result);
        } catch (error) {
            Logger.error('DataReplication: ❌ Sync failed:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
        }

        return result;
    }

    // Configuration for paginated pulls
    private readonly PULL_PAGE_SIZE = 100;
    private readonly MAX_PAGES_PER_TABLE = 100;

    /**
     * Pull changes from server and apply to local database
     * Uses cursor-based pagination to handle large datasets
     */
    private async pullFromServer(): Promise<{ count: number; conflicts: number }> {
        let totalPulled = 0;
        let totalConflicts = 0;

        for (const tableName of SYNC_TABLES) {
            try {
                let cursorTimestamp = this.lastSyncTimestamp;
                let hasMore = true;
                let pageNumber = 0;

                while (hasMore) {
                    pageNumber++;
                    Logger.debug(`DataReplication: 📥 Pulling ${tableName} page ${pageNumber}...`);

                    // Fetch records modified after cursor timestamp
                    const { data, error } = await supabase
                        .from(tableName)
                        .select('*')
                        .eq('user_id', this.userId)
                        .gt('server_updated_at', new Date(cursorTimestamp).toISOString())
                        .order('server_updated_at', { ascending: true })
                        .limit(this.PULL_PAGE_SIZE);

                    if (error) {
                        Logger.error(`DataReplication: Error pulling ${tableName}:`, error);
                        break; // Move to next table, don't fail entire sync
                    }

                    if (!data || data.length === 0) {
                        break;
                    }

                    Logger.debug(`DataReplication: 📥 Pulled ${data.length} records from ${tableName}`);

                    // Apply changes to local database
                    const { pulled, conflicts } = await this.applyPulledRecords(tableName, data);
                    totalPulled += pulled;
                    totalConflicts += conflicts;

                    // Update cursor for next page using last record's timestamp
                    const lastRecord = data[data.length - 1] as any;
                    cursorTimestamp = new Date(lastRecord.server_updated_at).getTime();

                    // Check if more pages exist
                    hasMore = data.length === this.PULL_PAGE_SIZE;

                    // Safety: Prevent infinite loops
                    if (pageNumber >= this.MAX_PAGES_PER_TABLE) {
                        Logger.warn(`DataReplication: ⚠️ Max pages (${this.MAX_PAGES_PER_TABLE}) reached for ${tableName}`);
                        break;
                    }
                }

                if (pageNumber > 1) {
                    Logger.info(`DataReplication: 📥 Completed ${tableName} sync in ${pageNumber} pages`);
                }
            } catch (error) {
                Logger.error(`DataReplication: Error processing ${tableName}:`, error);
            }
        }

        return { count: totalPulled, conflicts: totalConflicts };
    }

    /**
     * Apply pulled records to local database
     * Extracted for clarity and testability
     */
    private async applyPulledRecords(
        tableName: string,
        records: any[]
    ): Promise<{ pulled: number; conflicts: number }> {
        let pulled = 0;
        let conflicts = 0;

        await database.write(async () => {
            const collection = database.get(tableName);

            for (const serverRecord of records) {
                try {
                    // Try to find existing local record
                    const localRecord = await collection.find((serverRecord as any).id);

                    // Check for conflicts
                    const hasConflict = await this.detectConflict(localRecord, serverRecord);

                    if (hasConflict) {
                        // Resolve conflict (server wins for now - can be customized)
                        await this.resolveConflict(localRecord, serverRecord);
                        conflicts++;
                    } else {
                        // No conflict, just update
                        await localRecord.update((record: any) => {
                            this.applyServerData(record, serverRecord);
                        });
                    }

                    pulled++;
                } catch {
                    // Record doesn't exist locally, create it
                    await collection.create((record: any) => {
                        this.applyServerData(record, serverRecord);
                    });
                    pulled++;
                }
            }
        });

        return { pulled, conflicts };
    }

    /**
     * Push local changes to server
     */
    private async pushToServer(): Promise<{ count: number }> {
        let totalPushed = 0;

        for (const tableName of SYNC_TABLES) {
            try {
                const collection = database.get(tableName);

                // Get records with pending sync status
                const pendingRecords = await collection
                    .query(
                        Q.or(
                            Q.where('sync_status', 'pending'),
                            Q.where('sync_status', null)
                        )
                    )
                    .fetch();

                if (pendingRecords.length === 0) {
                    continue;
                }

                Logger.debug(`DataReplication: 📤 Pushing ${pendingRecords.length} records to ${tableName}`);

                // Upload in batches
                const batchSize = 50;
                for (let i = 0; i < pendingRecords.length; i += batchSize) {
                    const batch = pendingRecords.slice(i, i + batchSize);
                    const serverRecords = batch.map(record => this.serializeForServer(record, tableName));

                    // Upsert to server
                    const { error } = await (supabase
                        .from(tableName) as any)
                        .upsert(serverRecords as any[], { onConflict: 'id' } as any);

                    if (error) {
                        Logger.error(`DataReplication: Error pushing ${tableName}:`, error);
                        continue;
                    }

                    // Mark as synced locally
                    await database.write(async () => {
                        const batchOps = batch.map(record =>
                            record.prepareUpdate((r: any) => {
                                r.syncStatus = 'synced';
                                r.syncedAt = Date.now();
                            })
                        );
                        await database.batch(...batchOps);
                    });

                    totalPushed += batch.length;
                }
            } catch (error) {
                Logger.error(`DataReplication: Error pushing ${tableName}:`, error);
            }
        }

        return { count: totalPushed };
    }

    /**
     * Detect if there's a conflict between local and server record
     */
    private async detectConflict(localRecord: Model, serverRecord: any): Promise<boolean> {
        const localUpdated = (localRecord as any).serverUpdatedAt || 0;
        const serverUpdated = new Date(serverRecord.server_updated_at).getTime();

        // If local has changes that are newer than what server knows, it's a conflict
        const localSynced = (localRecord as any).syncedAt || 0;

        return localUpdated > localSynced && localUpdated > serverUpdated;
    }

    /**
     * Resolve conflict between local and server record
     * Strategy: Server wins (last-write-wins)
     * Can be customized to show conflict resolution UI
     */
    private async resolveConflict(localRecord: Model, serverRecord: any): Promise<void> {
        Logger.warn(`DataReplication: ⚠️ Conflict detected for ${localRecord.table} record ${localRecord.id}`);
        Logger.warn(`   Local updated: ${new Date((localRecord as any).serverUpdatedAt || 0).toISOString()}`);
        Logger.warn(`   Server updated: ${serverRecord.server_updated_at}`);

        // Add to conflict store for user resolution
        useSyncConflictStore.getState().addConflict({
            id: localRecord.id,
            tableName: localRecord.table,
            localRecord,
            serverRecord,
            resolve: async (strategy) => {
                await database.write(async () => {
                    if (strategy === 'keep_server') {
                        await localRecord.update((record: any) => {
                            this.applyServerData(record, serverRecord);
                            record.syncStatus = 'synced';
                        });
                    } else {
                        // Keep local
                        await localRecord.update((record: any) => {
                            record.serverUpdatedAt = new Date(serverRecord.server_updated_at).getTime();
                            record.syncStatus = 'pending';
                        });
                    }
                });
            }
        });
    }

    /**
     * Apply server data to local record
     */
    private applyServerData(localRecord: any, serverRecord: any): void {
        // Map server columns (snake_case) to local properties (camelCase)
        Object.keys(serverRecord).forEach(key => {
            if (key === 'id' || key === 'server_updated_at' || key === 'created_at_ts' || key === 'updated_at_ts') {
                return; // Skip metadata fields
            }

            const camelKey = this.snakeToCamel(key);
            localRecord[camelKey] = serverRecord[key];
        });

        // Update sync metadata
        localRecord.syncStatus = 'synced';
        localRecord.syncedAt = Date.now();
        localRecord.serverUpdatedAt = new Date(serverRecord.server_updated_at).getTime();
    }

    /**
     * Serialize local record for server upload
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private serializeForServer(record: Model, tableName: string): any {
        const raw = record._raw as any;
        const serverRecord: any = {
            id: record.id,
            user_id: this.userId,
        };

        // Map local properties (camelCase) to server columns (snake_case)
        Object.keys(raw).forEach(key => {
            if (key === '_status' || key === '_changed' || key === 'sync_status' || key === 'synced_at') {
                return; // Skip WatermelonDB metadata
            }

            const snakeKey = this.camelToSnake(key);
            serverRecord[snakeKey] = raw[key];
        });

        return serverRecord;
    }

    /**
     * Convert snake_case to camelCase
     */
    private snakeToCamel(str: string): string {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Convert camelCase to snake_case
     */
    private camelToSnake(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    /**
     * Load last sync timestamp from local storage
     */
    private async loadLastSyncTimestamp(): Promise<void> {
        try {
            const key = `weave:sync:lastTimestamp:${this.userId}`;
            const value = await AsyncStorage.getItem(key);
            this.lastSyncTimestamp = value ? parseInt(value, 10) : 0;
        } catch (error) {
            Logger.error('DataReplication: Failed to load last sync timestamp:', error);
            this.lastSyncTimestamp = 0;
        }
    }

    /**
     * Save last sync timestamp to local storage
     */
    private async saveLastSyncTimestamp(): Promise<void> {
        try {
            const key = `weave:sync:lastTimestamp:${this.userId}`;
            await AsyncStorage.setItem(key, this.lastSyncTimestamp.toString());
        } catch (error) {
            Logger.error('DataReplication: Failed to save last sync timestamp:', error);
        }
    }
}

// Legacy alias for backwards compatibility
export { DataReplicationService as SyncEngine };

/**
 * Initialize data replication for current user
 */
export function createDataReplicationService(userId: string): DataReplicationService {
    return new DataReplicationService(userId);
}

// Legacy alias for backwards compatibility
export const createSyncEngine = createDataReplicationService;

/**
 * Auto-sync hook - triggers sync on app state changes
 */
export async function triggerAutoSync(userId: string): Promise<void> {
    if (!userId) return;

    const engine = createDataReplicationService(userId);
    await engine.sync();
}
