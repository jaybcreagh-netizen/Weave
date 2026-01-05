# Sync System Implementation Plan

## Overview

This document outlines a hybrid approach to fix the current sync system while preparing for eventual migration to PowerSync. The strategy prioritizes:

1. **Immediate stability** - Get sync working reliably now
2. **PowerSync compatibility** - Design decisions that ease future migration
3. **Minimal disruption** - Incremental changes, no big-bang rewrites

---

## Architecture Vision

### Current State (Broken)
```
┌─────────────────────────────────────────────────────────────┐
│                    No Orchestration                         │
│              (5 independent sync mechanisms)                │
└─────────────────────────────────────────────────────────────┘
        │           │           │           │           │
   WatermelonDB  DataRep    ActionQueue  Realtime  Background
   (dead code)   (unused)   (partial)    (working)  (calls dead)
```

### Target State (Phase 1)
```
┌─────────────────────────────────────────────────────────────┐
│                    SyncOrchestrator                         │
│    (Unified coordinator - triggers, state, network)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────────┐ ┌───────────┐ ┌───────────────┐
│ DataReplication│ │ActionQueue│ │RealtimeService│
│ (Fixed)        │ │(Enhanced) │ │(Keep as-is)   │
└───────────────┘ └───────────┘ └───────────────┘
```

### Future State (Phase 3 - PowerSync)
```
┌─────────────────────────────────────────────────────────────┐
│                    PowerSync SDK                            │
│         (Handles sync, conflict resolution, streaming)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
              ┌───────┴───────┐
              │   Supabase    │
              └───────────────┘
```

---

## Phase 1: Fix DataReplicationService (Week 1-2)

### Goals
- Get sync working reliably
- Fix critical bugs
- Add all tables
- Wire up to app lifecycle
- Implement conflict UI

### 1.1 Delete Dead Code

**Files to delete:**
- `src/shared/services/sync.service.ts` (WatermelonDB sync - never called)

**Files to modify:**
- `src/modules/auth/services/background-event-sync.ts`
  - Remove import of `sync` from line 8
  - Remove `await sync()` call at lines 98-103

**Rationale:** Clean slate, no confusion about which sync to use.

---

### 1.2 Fix Field Name Mapping Bug

**Problem:** DataReplicationService assumes `syncStatus` but Friend model uses `customSyncStatus`

**File:** `src/modules/sync/services/data-replication.service.ts`

**Solution:** Create explicit field mapping configuration

```typescript
// Add after line 50
/**
 * Field name mappings for tables with non-standard naming
 * Maps server column names to WatermelonDB model property names
 */
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  friends: {
    sync_status: 'customSyncStatus',  // Friend model uses customSyncStatus
  },
  // Other tables use standard snake_to_camel conversion
};

/**
 * Reverse mappings for push operations
 */
const REVERSE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  friends: {
    customSyncStatus: 'sync_status',
  },
};
```

**Modify `applyServerData` method (around line 354):**

```typescript
private applyServerData(localRecord: any, serverRecord: any, tableName: string): void {
  const tableMapping = FIELD_MAPPINGS[tableName] || {};

  Object.keys(serverRecord).forEach(key => {
    if (key === 'id' || key === 'server_updated_at' || key === 'created_at_ts' || key === 'updated_at_ts') {
      return;
    }

    // Use explicit mapping if available, otherwise convert snake_case to camelCase
    const camelKey = tableMapping[key] || this.snakeToCamel(key);
    localRecord[camelKey] = serverRecord[key];
  });

  // Update sync metadata using correct field names
  const syncStatusField = tableMapping['sync_status'] || 'syncStatus';
  localRecord[syncStatusField] = 'synced';
  localRecord.syncedAt = Date.now();
  localRecord.serverUpdatedAt = new Date(serverRecord.server_updated_at).getTime();
}
```

**PowerSync Compatibility:** This mapping approach is compatible with PowerSync's schema-driven sync. When migrating, you'll define these mappings in PowerSync's sync rules instead.

---

### 1.3 Fix Pull/Push Race Condition

**Problem:** If user modifies data during pull, changes get overwritten.

**File:** `src/modules/sync/services/data-replication.service.ts`

**Solution:** Lock local writes during sync, use optimistic timestamps

```typescript
// Add to class properties (around line 57)
private syncLock: boolean = false;
private pendingWrites: Array<() => Promise<void>> = [];

/**
 * Acquire sync lock - prevents local writes during pull
 */
private async acquireSyncLock(): Promise<void> {
  this.syncLock = true;
}

/**
 * Release sync lock and process any pending writes
 */
private async releaseSyncLock(): Promise<void> {
  this.syncLock = false;

  // Process any writes that were queued during sync
  const writes = [...this.pendingWrites];
  this.pendingWrites = [];

  for (const write of writes) {
    try {
      await write();
    } catch (error) {
      Logger.error('DataReplication: Error processing queued write:', error);
    }
  }
}

/**
 * Modified sync method with locking
 */
async sync(): Promise<SyncResult> {
  if (this.isSyncing) {
    return { success: false, pulledRecords: 0, pushedRecords: 0, conflicts: 0, errors: ['Sync in progress'] };
  }

  this.isSyncing = true;
  const result: SyncResult = { success: true, pulledRecords: 0, pushedRecords: 0, conflicts: 0, errors: [] };

  try {
    await this.loadLastSyncTimestamp();

    // CRITICAL: Lock before pull to prevent writes during incoming changes
    await this.acquireSyncLock();

    try {
      // Phase 1: Pull (with lock held)
      const pullResult = await this.pullFromServer();
      result.pulledRecords = pullResult.count;
      result.conflicts += pullResult.conflicts;
    } finally {
      // Always release lock after pull
      await this.releaseSyncLock();
    }

    // Phase 2: Push (no lock needed - we're sending, not receiving)
    const pushResult = await this.pushToServer();
    result.pushedRecords = pushResult.count;

    this.lastSyncTimestamp = Date.now();
    await this.saveLastSyncTimestamp();

  } catch (error) {
    Logger.error('DataReplication: Sync failed:', error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    this.isSyncing = false;
  }

  return result;
}
```

**PowerSync Compatibility:** PowerSync handles this internally with transactional sync. This is a temporary fix.

---

### 1.4 Add All Tables to Sync

**File:** `src/modules/sync/services/data-replication.service.ts`

**Current (10 tables):**
```typescript
const SYNC_TABLES = [
  'friends', 'interactions', 'interaction_friends', 'intentions',
  'intention_friends', 'user_profiles', 'user_progress', 'life_events',
  'weekly_reflections', 'journal_entries',
] as const;
```

**Updated (all syncable tables):**
```typescript
/**
 * Tables to sync, ordered by dependency
 *
 * Tier 1: Core user data (no foreign keys to other synced tables)
 * Tier 2: Dependent data (references Tier 1)
 * Tier 3: Join tables and metadata
 */
const SYNC_TABLES = [
  // Tier 1: Core entities
  'user_profile',           // Note: singular in schema
  'user_progress',
  'friends',

  // Tier 2: Friend-dependent
  'interactions',
  'intentions',
  'life_events',
  'friend_badges',
  'groups',

  // Tier 3: Join tables
  'interaction_friends',
  'intention_friends',
  'group_members',
  'journal_entries',
  'journal_entry_friends',
  'weekly_reflections',

  // Tier 4: Analytics & metadata (optional - can skip for MVP)
  'suggestion_events',
  'portfolio_snapshots',
  'practice_log',
  'achievement_unlocks',
  'custom_chips',
  'chip_usage',
  'interaction_outcomes',
  'event_suggestion_feedback',
  'social_season_logs',
  'social_battery_logs',
  'network_health_logs',

  // Tier 5: AI/Oracle data (optional - may want local-only)
  // 'oracle_insights',
  // 'oracle_usage',
  // 'oracle_context_cache',
  // 'oracle_consultations',
  // 'journal_signals',
  // 'conversation_threads',
  // 'llm_quality_log',
  // 'proactive_insights',
  // 'milestone_records',
] as const;
```

**Note:** Some tables like `oracle_*` might be intentionally local-only for privacy. Decide based on product requirements.

**Required:** Add sync fields to tables that don't have them. See section 1.8.

---

### 1.5 Create SyncOrchestrator Service

**New file:** `src/modules/sync/services/sync-orchestrator.ts`

```typescript
/**
 * SyncOrchestrator
 *
 * Unified coordinator for all sync operations.
 * Handles:
 * - App lifecycle triggers (foreground/background)
 * - Network state changes
 * - Periodic sync
 * - Sync state management
 *
 * ARCHITECTURE: This is a thin coordinator, not a replacement for
 * DataReplicationService. It decides WHEN to sync, not HOW.
 *
 * POWERSYNC COMPATIBILITY: When migrating to PowerSync, this orchestrator
 * will be replaced by PowerSync's built-in sync management.
 */

import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { DataReplicationService } from './data-replication.service';
import { processQueue as processActionQueue } from './action-queue.service';
import { forceReconnect as reconnectRealtime } from './realtime.service';
import { useAuthStore } from '@/modules/auth/store/auth.store';
import { logger } from '@/shared/services/logger.service';

// Configuration
const SYNC_DEBOUNCE_MS = 5000;          // Don't sync more than once per 5 seconds
const PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;  // 15 minutes
const MIN_OFFLINE_DURATION_MS = 5000;   // Only trigger on reconnect if offline > 5s

// State
let replicationService: DataReplicationService | null = null;
let lastSyncTime = 0;
let isInitialized = false;
let periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
let wasOffline = false;
let offlineSince: number | null = null;

// Listeners (for cleanup)
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let netInfoUnsubscribe: (() => void) | null = null;

/**
 * Initialize the sync orchestrator
 * Call this after user authentication
 */
export function initializeSyncOrchestrator(userId: string): void {
  if (isInitialized) {
    logger.warn('SyncOrchestrator', 'Already initialized, skipping');
    return;
  }

  logger.info('SyncOrchestrator', `Initializing for user ${userId.slice(0, 8)}...`);

  replicationService = new DataReplicationService(userId);
  isInitialized = true;

  // Set up listeners
  setupAppStateListener();
  setupNetworkListener();
  setupPeriodicSync();

  // Initial sync on startup
  triggerSync('initialization');
}

/**
 * Clean up when user logs out
 */
export function teardownSyncOrchestrator(): void {
  logger.info('SyncOrchestrator', 'Tearing down...');

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }

  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
    periodicSyncTimer = null;
  }

  replicationService = null;
  isInitialized = false;
  lastSyncTime = 0;
}

/**
 * Trigger a sync operation
 * Debounced to prevent excessive syncing
 */
export async function triggerSync(reason: string): Promise<void> {
  if (!isInitialized || !replicationService) {
    logger.warn('SyncOrchestrator', `Cannot sync: not initialized (reason: ${reason})`);
    return;
  }

  // Debounce
  const now = Date.now();
  if (now - lastSyncTime < SYNC_DEBOUNCE_MS) {
    logger.debug('SyncOrchestrator', `Sync debounced (reason: ${reason})`);
    return;
  }

  // Check network
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    logger.info('SyncOrchestrator', `Offline, skipping sync (reason: ${reason})`);
    return;
  }

  logger.info('SyncOrchestrator', `Triggering sync (reason: ${reason})`);
  lastSyncTime = now;

  try {
    // Run both sync types in parallel
    const [replicationResult] = await Promise.all([
      replicationService.sync(),
      processActionQueue(),
    ]);

    logger.info('SyncOrchestrator', 'Sync completed', {
      pulled: replicationResult.pulledRecords,
      pushed: replicationResult.pushedRecords,
      conflicts: replicationResult.conflicts,
    });

  } catch (error) {
    logger.error('SyncOrchestrator', 'Sync failed:', error);
  }
}

/**
 * Force immediate sync (bypasses debounce)
 */
export async function forceSyncNow(): Promise<void> {
  lastSyncTime = 0;  // Reset debounce
  await triggerSync('force');
}

/**
 * Get current sync status
 */
export function getSyncStatus(): {
  isInitialized: boolean;
  lastSyncTime: number;
  isOnline: boolean;
} {
  return {
    isInitialized,
    lastSyncTime,
    isOnline: !wasOffline,
  };
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function setupAppStateListener(): void {
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    // App came to foreground
    triggerSync('app_foreground');
  } else if (nextState === 'background') {
    // App going to background - could trigger a final push here
    // But be careful about background execution limits
  }
}

function setupNetworkListener(): void {
  netInfoUnsubscribe = NetInfo.addEventListener(handleNetworkChange);
}

function handleNetworkChange(state: NetInfoState): void {
  if (state.isConnected) {
    if (wasOffline && offlineSince) {
      const offlineDuration = Date.now() - offlineSince;

      if (offlineDuration >= MIN_OFFLINE_DURATION_MS) {
        // Was meaningfully offline, now reconnected
        logger.info('SyncOrchestrator', `Network reconnected after ${offlineDuration}ms offline`);

        // Reconnect realtime subscriptions
        reconnectRealtime().catch(err => {
          logger.error('SyncOrchestrator', 'Failed to reconnect realtime:', err);
        });

        // Trigger sync
        triggerSync('network_reconnect');
      }
    }

    wasOffline = false;
    offlineSince = null;
  } else {
    if (!wasOffline) {
      wasOffline = true;
      offlineSince = Date.now();
      logger.info('SyncOrchestrator', 'Network disconnected');
    }
  }
}

function setupPeriodicSync(): void {
  periodicSyncTimer = setInterval(() => {
    triggerSync('periodic');
  }, PERIODIC_SYNC_INTERVAL_MS);
}
```

---

### 1.6 Wire Orchestrator to App Lifecycle

**File:** `src/shared/components/DataInitializer.tsx`

**Add import (around line 28):**
```typescript
import { initializeSyncOrchestrator, teardownSyncOrchestrator } from '@/modules/sync';
```

**Add effect after auth initialization (after line 252):**
```typescript
// Initialize sync orchestrator when user is authenticated
useEffect(() => {
  const initSync = async () => {
    try {
      const user = useAuthStore.getState().user;
      if (user?.id) {
        initializeSyncOrchestrator(user.id);
      }
    } catch (error) {
      console.error('[App] Failed to initialize sync orchestrator:', error);
    }
  };

  // Subscribe to auth changes
  const unsubscribe = useAuthStore.subscribe(
    (state) => state.user,
    (user, prevUser) => {
      if (user?.id && !prevUser?.id) {
        // User logged in
        initializeSyncOrchestrator(user.id);
      } else if (!user?.id && prevUser?.id) {
        // User logged out
        teardownSyncOrchestrator();
      }
    }
  );

  // Initial check
  initSync();

  return () => {
    unsubscribe();
    teardownSyncOrchestrator();
  };
}, []);
```

---

### 1.7 Implement Conflict UI (Toast + Settings Inbox)

**Your choice:** Toast notification + inbox in Settings (non-interrupting)

#### 1.7.1 Create Conflict Toast Hook

**New file:** `src/modules/sync/hooks/useConflictNotifications.ts`

```typescript
/**
 * Hook to show toast notifications for sync conflicts
 */

import { useEffect, useRef } from 'react';
import { useSyncConflict } from '@/modules/auth/context/SyncConflictContext';
import { useUIStore } from '@/shared/stores/uiStore';

export function useConflictNotifications() {
  const { conflicts } = useSyncConflict();
  const showToast = useUIStore(state => state.showToast);
  const lastNotifiedCount = useRef(0);

  useEffect(() => {
    // Only notify when new conflicts are added
    if (conflicts.length > lastNotifiedCount.current) {
      const newCount = conflicts.length - lastNotifiedCount.current;

      showToast({
        type: 'warning',
        title: 'Sync Conflict',
        message: `${newCount} item${newCount > 1 ? 's need' : ' needs'} your attention`,
        action: {
          label: 'Review',
          onPress: () => {
            // Navigate to settings or open conflict sheet
            // This will be implemented in the ConflictInbox component
          }
        }
      });
    }

    lastNotifiedCount.current = conflicts.length;
  }, [conflicts.length, showToast]);
}
```

#### 1.7.2 Create Conflict Resolution Sheet

**New file:** `src/modules/sync/components/ConflictResolutionSheet.tsx`

```typescript
/**
 * Bottom sheet for resolving sync conflicts
 * Shows one conflict at a time with local vs server comparison
 */

import React, { useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useSyncConflict } from '@/modules/auth/context/SyncConflictContext';
import { useTheme } from '@/shared/hooks/useTheme';

interface Props {
  sheetRef: React.RefObject<BottomSheet>;
}

export function ConflictResolutionSheet({ sheetRef }: Props) {
  const { currentConflict, resolveConflict } = useSyncConflict();
  const { colors } = useTheme();

  const handleKeepLocal = useCallback(async () => {
    if (!currentConflict) return;

    await currentConflict.resolve('keep_local');
    resolveConflict(currentConflict.id);
  }, [currentConflict, resolveConflict]);

  const handleKeepServer = useCallback(async () => {
    if (!currentConflict) return;

    await currentConflict.resolve('keep_server');
    resolveConflict(currentConflict.id);
  }, [currentConflict, resolveConflict]);

  if (!currentConflict) return null;

  // Format record data for display
  const formatRecord = (record: any) => {
    const displayFields = ['name', 'title', 'description', 'content', 'notes'];
    const entries = Object.entries(record)
      .filter(([key]) => displayFields.includes(key))
      .slice(0, 3);

    return entries.map(([key, value]) => (
      <Text key={key} variant="body" className="text-gray-600">
        {key}: {String(value).slice(0, 50)}
      </Text>
    ));
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['50%', '80%']}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.card }}
    >
      <BottomSheetView className="flex-1 p-4">
        <Text variant="h3" className="mb-4">Resolve Sync Conflict</Text>

        <Text variant="body" className="mb-4 text-gray-500">
          This {currentConflict.tableName.slice(0, -1)} was modified in two places.
          Choose which version to keep:
        </Text>

        <ScrollView className="flex-1">
          {/* Local Version */}
          <Card className="mb-4 p-4">
            <Text variant="h4" className="mb-2">Your Version (Local)</Text>
            <Text variant="caption" className="mb-2 text-gray-500">
              Modified on this device
            </Text>
            {formatRecord(currentConflict.localRecord)}
          </Card>

          {/* Server Version */}
          <Card className="mb-4 p-4">
            <Text variant="h4" className="mb-2">Cloud Version</Text>
            <Text variant="caption" className="mb-2 text-gray-500">
              From another device or sync
            </Text>
            {formatRecord(currentConflict.serverRecord)}
          </Card>
        </ScrollView>

        <View className="flex-row gap-3 mt-4">
          <Button
            variant="outline"
            onPress={handleKeepLocal}
            className="flex-1"
          >
            Keep Local
          </Button>
          <Button
            variant="solid"
            onPress={handleKeepServer}
            className="flex-1"
          >
            Keep Cloud
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
```

#### 1.7.3 Add Conflict Indicator to Settings

**File to modify:** Settings screen (add conflict count badge)

```typescript
// In settings screen, add:
import { useSyncConflict } from '@/modules/auth/context/SyncConflictContext';

// In component:
const { conflicts } = useSyncConflict();

// In render:
<SettingsRow
  icon="cloud-off"
  title="Sync Issues"
  subtitle={conflicts.length > 0 ? `${conflicts.length} conflicts to resolve` : 'All synced'}
  onPress={() => openConflictSheet()}
  badge={conflicts.length > 0 ? conflicts.length : undefined}
/>
```

---

### 1.8 Add Sync Fields to Missing Tables

**Problem:** Many tables lack `user_id`, `sync_status`, `synced_at`, `server_updated_at`

**Required migration:** Add columns to tables that need syncing

**New migration file:** `src/db/migrations/v55_add_sync_fields.ts`

```typescript
import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 55,
      steps: [
        // Add sync fields to tables that need them
        addColumns({
          table: 'friend_badges',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'groups',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'server_updated_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'group_members',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
          ],
        }),
        // ... Add to other tables as needed
      ],
    },
  ],
});
```

**Also update schema.ts** to include these columns in the table definitions.

---

### 1.9 Add Deduplication to ActionQueue

**File:** `src/modules/sync/services/action-queue.service.ts`

**Add deduplication check in `enqueueOperation` (around line 40):**

```typescript
/**
 * Enqueue an operation for sync
 * Includes deduplication to prevent duplicate operations
 */
export async function enqueueOperation(
  operationType: SyncOperationType,
  payload: Record<string, unknown>,
  options?: { idempotencyKey?: string }
): Promise<string | null> {
  const queueCollection = database.get<SyncQueueItem>('sync_queue');

  // Generate idempotency key from operation type and payload
  const idempotencyKey = options?.idempotencyKey ||
    generateIdempotencyKey(operationType, payload);

  // Check for existing pending/processing operation with same key
  const existing = await queueCollection
    .query(
      Q.where('status', Q.oneOf(['pending', 'processing'])),
    )
    .fetch();

  // Check payload match (since we don't have idempotency_key column yet)
  const duplicate = existing.find(item => {
    try {
      const existingPayload = JSON.parse(item.payload);
      return item.operationType === operationType &&
        JSON.stringify(existingPayload) === JSON.stringify(payload);
    } catch {
      return false;
    }
  });

  if (duplicate) {
    logger.debug('ActionQueue', `Duplicate operation skipped: ${operationType}`, {
      existingId: duplicate.id
    });
    return duplicate.id;
  }

  // Proceed with enqueue
  let itemId = '';

  await database.write(async () => {
    const item = await queueCollection.create(record => {
      record.operationType = operationType;
      record.payload = JSON.stringify(payload);
      record.status = 'pending';
      record.retryCount = 0;
      record.queuedAt = Date.now();
    });
    itemId = item.id;
  });

  logger.info('ActionQueue', `Enqueued operation: ${operationType}`, { itemId });
  startProcessing();

  return itemId;
}

/**
 * Generate a consistent key for deduplication
 */
function generateIdempotencyKey(
  operationType: SyncOperationType,
  payload: Record<string, unknown>
): string {
  // Sort keys for consistent serialization
  const sortedPayload = Object.keys(payload)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: payload[key] }), {});

  return `${operationType}:${JSON.stringify(sortedPayload)}`;
}
```

---

### 1.10 Update Module Exports

**File:** `src/modules/sync/index.ts`

Add exports for new files:

```typescript
// Sync Orchestrator
export {
  initializeSyncOrchestrator,
  teardownSyncOrchestrator,
  triggerSync,
  forceSyncNow,
  getSyncStatus,
} from './services/sync-orchestrator';

// Conflict UI
export { ConflictResolutionSheet } from './components/ConflictResolutionSheet';
export { useConflictNotifications } from './hooks/useConflictNotifications';
```

---

## Phase 1 Checklist

- [ ] Delete `src/shared/services/sync.service.ts`
- [ ] Remove sync() import from background-event-sync.ts
- [ ] Add FIELD_MAPPINGS to data-replication.service.ts
- [ ] Fix applyServerData to use field mappings
- [ ] Add sync lock mechanism
- [ ] Update SYNC_TABLES with all tables
- [ ] Create sync-orchestrator.ts
- [ ] Wire orchestrator to DataInitializer.tsx
- [ ] Create ConflictResolutionSheet.tsx
- [ ] Create useConflictNotifications.ts
- [ ] Add conflict indicator to Settings
- [ ] Add deduplication to action-queue.service.ts
- [ ] Create v55 migration for sync fields
- [ ] Update schema.ts with sync fields
- [ ] Update sync/index.ts exports
- [ ] Test end-to-end sync flow
- [ ] Test conflict resolution UI
- [ ] Test offline → online sync

---

## Phase 2: PowerSync Evaluation (Week 3-4)

### Goals
- Validate PowerSync works with your Supabase schema
- Test with 2-3 core tables
- Compare performance and reliability
- Make go/no-go decision

### 2.1 Set Up PowerSync Cloud

1. **Create account** at [powersync.com](https://www.powersync.com)
2. **Create instance** in dashboard
3. **Connect to Supabase:**
   - Create dedicated Postgres role with replication privileges
   - Add connection string to PowerSync
   - Enable Supabase Auth integration

### 2.2 Create Sync Rules (YAML)

**File:** `powersync/sync-rules.yaml` (new directory)

```yaml
# PowerSync Sync Rules for Weave
# Reference: https://docs.powersync.com/usage/sync-rules

bucket_definitions:
  # User's friends bucket
  user_friends:
    # Parameters define the bucket key
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM friends WHERE user_id = bucket.user_id

  # User's interactions bucket
  user_interactions:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM interactions WHERE user_id = bucket.user_id

  # User's profile bucket
  user_profile:
    parameters: SELECT request.user_id() AS user_id
    data:
      - SELECT * FROM user_profile WHERE user_id = bucket.user_id
```

### 2.3 Create Proof-of-Concept Branch

```bash
git checkout -b feature/powersync-poc
npm install @powersync/react-native
```

### 2.4 Create PowerSync Client

**New file:** `src/shared/services/powersync-client.ts`

```typescript
/**
 * PowerSync Client (Proof of Concept)
 *
 * This file is for evaluation only.
 * If PowerSync works well, this will replace DataReplicationService.
 */

import { PowerSyncDatabase } from '@powersync/react-native';
import { supabase } from '@/modules/auth/services/supabase.service';

// PowerSync instance URL from dashboard
const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL || '';

let powerSyncDb: PowerSyncDatabase | null = null;

export async function initializePowerSync(): Promise<PowerSyncDatabase> {
  if (powerSyncDb) return powerSyncDb;

  powerSyncDb = new PowerSyncDatabase({
    // Schema will be defined here
    schema: {
      // Minimal schema for POC - just friends table
      friends: {
        id: 'TEXT PRIMARY KEY',
        name: 'TEXT',
        dunbar_tier: 'TEXT',
        weave_score: 'REAL',
        // ... other columns
      },
    },
    database: {
      // Use existing database path or create new for POC
      dbFilename: 'powersync-poc.db',
    },
  });

  // Connect to PowerSync
  await powerSyncDb.connect(
    new SupabaseConnector(supabase, POWERSYNC_URL)
  );

  return powerSyncDb;
}

// Supabase connector for PowerSync
class SupabaseConnector {
  constructor(
    private supabase: typeof supabase,
    private powerSyncUrl: string
  ) {}

  async fetchCredentials() {
    const { data: { session } } = await this.supabase.auth.getSession();

    return {
      endpoint: this.powerSyncUrl,
      token: session?.access_token || '',
    };
  }

  async uploadData(database: PowerSyncDatabase) {
    // Handle writes - send to Supabase
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      const table = op.table;
      const data = op.opData;

      switch (op.op) {
        case 'PUT':
          await this.supabase.from(table).upsert(data);
          break;
        case 'PATCH':
          await this.supabase.from(table).update(data).eq('id', op.id);
          break;
        case 'DELETE':
          await this.supabase.from(table).delete().eq('id', op.id);
          break;
      }
    }

    await transaction.complete();
  }
}
```

### 2.5 Evaluation Criteria

| Criteria | Target | How to Measure |
|----------|--------|----------------|
| **Setup complexity** | < 1 day | Time to get first sync working |
| **Sync latency** | < 2s | Time from change to sync |
| **Offline reliability** | 100% | Offline edits sync correctly |
| **Conflict handling** | Works | Test concurrent edits |
| **Bundle size impact** | < 500KB | Before/after comparison |
| **Battery impact** | Minimal | Monitor during testing |

### 2.6 Decision Point

After POC, decide:
- **Go:** Proceed to Phase 3 (full migration)
- **No-go:** Stay with fixed DataReplicationService
- **Defer:** Keep POC, revisit later

---

## Phase 3: PowerSync Migration (If Go Decision)

### Goals
- Incrementally migrate from DataReplicationService to PowerSync
- Keep WatermelonDB for local queries initially
- Eventually evaluate if WatermelonDB is still needed

### 3.1 Migration Strategy

**Approach:** Table-by-table migration with feature flags

```typescript
// Feature flag for gradual rollout
const POWERSYNC_ENABLED_TABLES = [
  'friends',      // Week 1
  'interactions', // Week 2
  // ... add more as validated
];

// In SyncOrchestrator, route based on flag
async function syncTable(tableName: string) {
  if (POWERSYNC_ENABLED_TABLES.includes(tableName)) {
    // PowerSync handles this table
    return;
  }

  // DataReplicationService handles this table
  await replicationService.syncTable(tableName);
}
```

### 3.2 Data Migration

For each table:

1. **Export from WatermelonDB** → Push to Supabase
2. **Enable PowerSync sync rules** for table
3. **Verify data consistency**
4. **Disable DataReplicationService** for table

### 3.3 Remove WatermelonDB Dependency (Long-term)

Once all tables are on PowerSync:

1. Evaluate if WatermelonDB observables are still needed
2. PowerSync provides reactive queries via SQLite
3. If equivalent, remove WatermelonDB dependency
4. Significant bundle size reduction

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | 1-2 weeks | Working sync with DataReplicationService |
| **Phase 2** | 1-2 weeks | PowerSync POC + go/no-go decision |
| **Phase 3** | 2-4 weeks | Full PowerSync migration (if Go) |

---

## Risk Mitigation

### Phase 1 Risks

| Risk | Mitigation |
|------|------------|
| Sync lock causes deadlocks | Add timeout, monitor in production |
| Field mapping breaks existing data | Test with backup, rollback plan |
| Too many tables overwhelm sync | Tier tables, sync critical first |

### Phase 2 Risks

| Risk | Mitigation |
|------|------------|
| PowerSync doesn't work with schema | Early POC, fail fast |
| Performance worse than expected | Benchmark before committing |
| Pricing becomes prohibitive | Self-hosted option available |

### Phase 3 Risks

| Risk | Mitigation |
|------|------------|
| Migration breaks production | Feature flags, gradual rollout |
| WatermelonDB removal breaks queries | Test thoroughly before removal |

---

## Files Changed Summary

### New Files
- `src/modules/sync/services/sync-orchestrator.ts`
- `src/modules/sync/components/ConflictResolutionSheet.tsx`
- `src/modules/sync/hooks/useConflictNotifications.ts`
- `src/db/migrations/v55_add_sync_fields.ts`
- `powersync/sync-rules.yaml` (Phase 2)
- `src/shared/services/powersync-client.ts` (Phase 2)

### Modified Files
- `src/modules/sync/services/data-replication.service.ts`
- `src/modules/sync/services/action-queue.service.ts`
- `src/modules/auth/services/background-event-sync.ts`
- `src/shared/components/DataInitializer.tsx`
- `src/modules/sync/index.ts`
- `src/db/schema.ts`

### Deleted Files
- `src/shared/services/sync.service.ts`

---

## Next Steps

1. **Review this plan** - Any concerns or modifications?
2. **Prioritize Phase 1 tasks** - Which to tackle first?
3. **Set up branch** - Create feature branch for implementation
4. **Start implementation** - Begin with quick wins (delete dead code)
