# Sync System Implementation Plan

## Overview

This document outlines the approach to fix the sync system using WatermelonDB's native `synchronize()` function with custom Supabase Edge Functions. This approach was chosen over fixing DataReplicationService based on architecture review feedback.

**Key Decision:** Use WatermelonDB's built-in sync protocol instead of custom client-side iteration. This provides:
- Single HTTP request for all tables (vs 15+ sequential requests)
- Battle-tested sync logic with proper conflict handling
- Better mobile performance and battery efficiency

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
   (broken-     (unused)   (partial)    (working)  (calls broken
    no backend)                                     sync)
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
│ WatermelonDB  │ │ActionQueue│ │RealtimeService│
│ synchronize() │ │(Enhanced) │ │(Keep as-is)   │
│ + Edge Funcs  │ └───────────┘ └───────────────┘
└───────────────┘
        │
        ▼
┌───────────────┐
│ sync-pull     │  (NEW - Supabase Edge Function)
│ sync-push     │  (NEW - Supabase Edge Function)
└───────────────┘
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

## Why WatermelonDB Sync Over DataReplicationService

Based on architecture review feedback, we're using WatermelonDB's native sync:

| Aspect | DataReplicationService (Old Plan) | WatermelonDB Sync (New Plan) |
|--------|-----------------------------------|------------------------------|
| HTTP requests | 15+ sequential (one per table) | 1-2 total (batched) |
| Conflict handling | Manual, error-prone | Framework-managed |
| Delete tracking | Not implemented | Built-in tombstones |
| Mobile efficiency | Poor (chatty) | Optimized |
| Maintenance | We own it forever | Framework-supported |

---

## Phase 1: Enable WatermelonDB Sync (Week 1-2)

### 1.1 Deploy Edge Functions

**New files created:**
- `supabase/functions/sync-pull/index.ts` - Fetches changes since lastPulledAt
- `supabase/functions/sync-push/index.ts` - Applies client changes to database
- `supabase/migrations/20260105_deleted_records_tombstone.sql` - Tracks deletions

**Deploy commands:**
```bash
# Deploy sync-pull function
supabase functions deploy sync-pull

# Deploy sync-push function
supabase functions deploy sync-push

# Apply tombstone migration
supabase db push
```

### 1.2 Edge Function: sync-pull

**Purpose:** Returns all changes since `lastPulledAt` for the authenticated user.

**Request:**
```typescript
{
  lastPulledAt: number | null,  // Milliseconds timestamp (null for first sync)
  schemaVersion: number,
  migration: object | null
}
```

**Response:**
```typescript
{
  changes: {
    [tableName]: {
      created: [...records],  // Records created since lastPulledAt
      updated: [...records],  // Records updated since lastPulledAt
      deleted: [...ids]       // IDs deleted since lastPulledAt
    }
  },
  timestamp: number  // Server time in milliseconds
}
```

**Tables synced:**
1. `user_profile` - User settings and preferences
2. `user_progress` - Streaks, achievements
3. `friends` - Friend records
4. `interactions` - Weave logs
5. `intentions` - User intentions
6. `life_events` - Friend life events
7. `interaction_friends` - Join table
8. `intention_friends` - Join table
9. `weekly_reflections` - Weekly summaries
10. `journal_entries` - Journal entries

### 1.3 Edge Function: sync-push

**Purpose:** Applies client changes to the database.

**Request:**
```typescript
{
  changes: {
    [tableName]: {
      created: [...records],
      updated: [...records],
      deleted: [...ids]
    }
  },
  lastPulledAt: number
}
```

**Response:**
```typescript
{
  success: true,
  stats: { created: number, updated: number, deleted: number }
}
```

**Security:**
- All records have `user_id` forced to authenticated user
- RLS policies enforce ownership
- Only allowed tables can be synced

### 1.4 Tombstone Table for Delete Tracking

**Problem:** WatermelonDB sync needs to know about deleted records.

**Solution:** `deleted_records` tombstone table with automatic triggers.

```sql
CREATE TABLE deleted_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, table_name, record_id)
);
```

**Auto-tracking:** Triggers on all synced tables automatically record deletions:
```sql
CREATE TRIGGER track_friends_deletion
  AFTER DELETE ON friends
  FOR EACH ROW EXECUTE FUNCTION record_deletion();
```

**Cleanup:** Tombstones older than 30 days are purged via `cleanup_old_tombstones()`.

---

### 1.5 Create SyncOrchestrator

**File:** `src/modules/sync/services/sync-orchestrator.ts`

The orchestrator coordinates WHEN sync happens (not HOW - that's WatermelonDB's job).

**Triggers:**
- App foreground (immediate)
- Network reconnect (after offline)
- Periodic (every 15 minutes)

```typescript
import { sync } from '@/shared/services/sync.service';

export class SyncOrchestrator {
  private lastSyncTime = 0;
  private readonly DEBOUNCE_MS = 5000;
  private readonly PERIODIC_MS = 15 * 60 * 1000;

  initialize(userId: string) {
    this.setupAppStateListener();
    this.setupNetworkListener();
    this.setupPeriodicSync();
    this.triggerSync('initialization');
  }

  async triggerSync(reason: string) {
    // Debounce
    if (Date.now() - this.lastSyncTime < this.DEBOUNCE_MS) return;

    // Check network
    const isOnline = await NetInfo.fetch().then(s => s.isConnected);
    if (!isOnline) return;

    // Run WatermelonDB sync
    try {
      await sync();
      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

---

### 1.6 Wire Orchestrator to App Lifecycle

**File:** `src/shared/components/DataInitializer.tsx`

Add initialization after auth:

```typescript
import { initializeSyncOrchestrator } from '@/modules/sync';

useEffect(() => {
  const user = useAuthStore.getState().user;
  if (user?.id) {
    initializeSyncOrchestrator(user.id);
  }
}, []);
```

---

### 1.7 Fix background-event-sync.ts

**Problem:** Currently calls `sync()` but it was previously broken.

**Solution:** Now that Edge Functions exist, the call will work. Just ensure it's called correctly.

**File:** `src/modules/auth/services/background-event-sync.ts`

```typescript
// Line 99 - This will now work with Edge Functions
try {
  await sync();
  Logger.info('[BackgroundSync] Native sync completed');
} catch (error) {
  Logger.error('[BackgroundSync] Native sync failed:', error);
}
```

---

### 1.8 Conflict Resolution UI

**Approach:** Toast notification + Settings inbox (non-interrupting)

WatermelonDB handles most conflicts automatically (last-write-wins). For edge cases:

1. **Toast:** "Sync completed - 2 items updated from cloud"
2. **Settings indicator:** Show sync status and last sync time
3. **Manual sync button:** Allow user to force sync

**Note:** Complex conflict resolution (showing both versions) deferred to PowerSync migration.

---

## Phase 1 Checklist

- [x] Create `supabase/functions/sync-pull/index.ts`
- [x] Create `supabase/functions/sync-push/index.ts`
- [x] Create `supabase/migrations/20260105_deleted_records_tombstone.sql`
- [ ] Deploy Edge Functions to Supabase
- [ ] Apply tombstone migration
- [ ] Create `sync-orchestrator.ts`
- [ ] Wire orchestrator to `DataInitializer.tsx`
- [ ] Test end-to-end sync flow
- [ ] Add sync status to Settings screen
- [ ] Test offline → online sync
- [ ] Test delete sync across devices

---

## Phase 2: Hardening & Monitoring (Week 2-3)

### 2.1 Add Deduplication to ActionQueue

**File:** `src/modules/sync/services/action-queue.service.ts`

Prevent duplicate operations when user clicks multiple times:

```typescript
export async function enqueueOperation(
  operationType: SyncOperationType,
  payload: Record<string, unknown>
): Promise<string | null> {
  // Check for existing pending operation
  const existing = await queueCollection
    .query(Q.where('status', Q.oneOf(['pending', 'processing'])))
    .fetch();

  const duplicate = existing.find(item =>
    item.operationType === operationType &&
    JSON.stringify(JSON.parse(item.payload)) === JSON.stringify(payload)
  );

  if (duplicate) {
    return duplicate.id; // Return existing, don't enqueue duplicate
  }

  // Proceed with enqueue...
}
```

### 2.2 Rename Conflicting Store

**Problem:** `sync.store.ts` manages calendar sync, causing confusion.

**Solution:** Rename to `background-event-sync.store.ts`

**Files to rename:**
- `src/modules/auth/store/sync.store.ts` → `background-event-sync.store.ts`
- Update all imports

### 2.3 Add Sync Analytics

Track sync performance:
- Sync duration
- Records synced (created/updated/deleted)
- Sync failures
- Network conditions during sync

---

## Phase 3: PowerSync Evaluation (Week 4+)

Once WatermelonDB sync is stable, evaluate PowerSync as described in original plan.

**Criteria:**
- Does it handle our schema?
- Performance comparison
- Conflict resolution capabilities
- Cost analysis

---

## Files Changed Summary

### New Files
- `supabase/functions/sync-pull/index.ts`
- `supabase/functions/sync-pull/deno.json`
- `supabase/functions/sync-push/index.ts`
- `supabase/functions/sync-push/deno.json`
- `supabase/migrations/20260105_deleted_records_tombstone.sql`
- `src/modules/sync/services/sync-orchestrator.ts` (to create)

### Modified Files
- `src/shared/components/DataInitializer.tsx` (wire orchestrator)
- `src/modules/sync/services/action-queue.service.ts` (add deduplication)
- `src/modules/auth/store/sync.store.ts` (rename)

### Unchanged (Now Works)
- `src/shared/services/sync.service.ts` - Now functional with Edge Functions

---

## Addressing Review Feedback

| Feedback | Resolution |
|----------|------------|
| "Sync lock is ineffective" | Removed. Using WatermelonDB's built-in conflict handling instead. |
| "Dead code misclassification" | Corrected. `sync.service.ts` is now functional with Edge Functions. |
| "Client-side iteration is inefficient" | Resolved. Using WatermelonDB `synchronize()` with single-request batching. |
| "Naming collision" | Will rename `sync.store.ts` → `background-event-sync.store.ts` |

---

## Deployment Steps

```bash
# 1. Deploy Edge Functions
cd supabase
supabase functions deploy sync-pull
supabase functions deploy sync-push

# 2. Apply database migration
supabase db push

# 3. Verify deployment
supabase functions list

# 4. Test locally
supabase functions serve sync-pull
supabase functions serve sync-push
```

---

## Testing Plan

### Unit Tests
- [ ] sync-pull returns correct format
- [ ] sync-push applies changes correctly
- [ ] Tombstones are created on delete
- [ ] RLS policies enforce ownership

### Integration Tests
- [ ] Full sync cycle (pull → local changes → push)
- [ ] Offline changes sync on reconnect
- [ ] Delete syncs across devices
- [ ] Concurrent edits resolve correctly

### Manual Tests
- [ ] Create friend on Device A, appears on Device B
- [ ] Edit friend on Device A, updates on Device B
- [ ] Delete friend on Device A, disappears on Device B
- [ ] Offline edit on Device A syncs when online

---

## References

- [WatermelonDB Sync Implementation](https://watermelondb.dev/docs/Implementation/SyncImpl)
- [WatermelonDB Backend Guide](https://watermelondb.dev/docs/Sync/Backend)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Offline-first with WatermelonDB + Supabase](https://supabase.com/blog/react-native-offline-first-watermelon-db)
