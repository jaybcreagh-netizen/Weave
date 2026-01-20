# Supabase Realtime Performance Analysis

> [!WARNING]
> **Critical Performance Bottleneck Detected**
> Analysis of the Supabase query logs has revealed a major scalability issue in how the application handles Realtime updates for Shared Weaves.

## 1. The Symptom

In the `supabase_query_performance.csv` logs, the query `realtime.list_changes` is the #1 consumer of database resources:

| Metric | Value |
| :--- | :--- |
| **Call Count** | **732,182** |
| **Total Time** | **~1 hour (CPU time)** |
| **Mean Time** | ~4.9ms |

This volume is disproportionately high compared to standard application queries (profiles, friends, etc.), indicating that the database is spending most of its energy processing Realtime subscription streams rather than serving user requests.

## 2. Root Cause Analysis

The issue stems from an **unfiltered subscription** to the `shared_weaves` table in `realtime.service.ts`.

### The Code
```typescript
// src/modules/sync/services/realtime.service.ts

realtimeChannel
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'shared_weaves',
      // ❌ MISSING FILTER: Subscribes to ALL 100% of weave updates in the database
    },
    (payload) => { ... }
  )
```

### The Mechanism of Failure
1.  **Event Generation**: When *any* user updates *any* weave (e.g., changing a title), Postgres emits a WAL record.
2.  **Realtime Processing**: The Supabase Realtime server receives this event.
3.  **The Fan-Out**: Because the client subscription has NO filter (like `id=eq.123`), Realtime cannot discard the event immediately.
4.  **RLS Enforcement**: To decide if a specific connected user is *allowed* to see this event, Realtime must query the database to check the Row Level Security (RLS) policy for that specific row against that specific user.
5.  **Quadratic Load**:
    *   If you have **1,000 connected users**...
    *   And **1 user** updates a weave...
    *   The database has to run **1,000 RLS checks** (one for each listener) to determine who gets the notification.
    *   Most of these checks return `false`, meaning the database did work for nothing.

## 3. Why the Current RLS is Expensive

The RLS policy for `shared_weaves` relies on a join/subquery to `shared_weave_participants`:

```sql
CREATE POLICY "Participants can view shared weaves"
ON public.shared_weaves
USING (
  -- This requires a JOIN or subquery for every check
  EXISTS (
    SELECT 1 FROM shared_weave_participants
    WHERE shared_weave_id = id AND user_id = auth.uid()
  )
);
```

Checking this policy 1,000 times for every single update is what is causing the `realtime.list_changes` spike.

## 4. The Solution: The "Signal Table" Pattern

To fix this, we need to move the filtering logic from **Read Time** (RLS Check) to **Write Time** (Trigger).

### Concept
Instead of listeners asking "Is this update for me?", the database should say "Here is an update for User X".

1.  **Create a `sync_signals` table**:
    *   `id`: uuid
    *   `user_id`: uuid (The recipient)
    *   `payload`: jsonb (The data they need)

2.  **Database Trigger**:
    *   When a `shared_weave` is updated, a trigger fires.
    *   The trigger finds the participants for that weave.
    *   It inserts a row into `sync_signals` for *only* those participants.

3.  **Client Subscription**:
    *   Clients subscribe ONLY to `sync_signals` with a filter: `user_id=eq.MY_ID`.

### Impact
*   **0% False Positives**: The client only receives events meant for them.
*   **No RLS Storm**: The Realtime server sees the `user_id=eq...` filter and routes the message directly ensuring O(1) performance per recipient, without querying the DB for permissions.

## 5. Next Steps

1.  Apply migration `20260115_realtime_signals.sql`.
2.  Update `realtime.service.ts` to listen to `sync_signals`.
