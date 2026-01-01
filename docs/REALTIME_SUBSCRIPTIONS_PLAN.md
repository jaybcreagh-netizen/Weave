# Realtime Subscriptions Implementation Plan

## Current State

The app has a fully implemented `realtime.service.ts` that provides:
- `subscribeToRealtime()` - Supabase Realtime subscription to `shared_weave_participants` and `friend_links`
- `onIncomingWeave()` / `onIncomingLink()` - Handler registration with deduplication
- Auto-reconnect with exponential backoff
- Connection status monitoring

**Problem:** These functions are implemented but **never called**. The app relies entirely on polling (foreground sync) rather than push-based updates.

## Benefits of Enabling Realtime

1. **Instant notifications** - Users see shared weaves and link requests immediately
2. **Reduced latency** - No waiting for app foreground to see updates
3. **Better UX** - Real-time badge updates, instant status changes
4. **Reduced server load** - Fewer polling requests (though we keep polling as fallback)

## Implementation Steps

### Phase 1: Wire Up Subscription Lifecycle

**File:** `src/shared/components/AppProviders.tsx` or create new `src/shared/components/RealtimeProvider.tsx`

```typescript
import { useEffect } from 'react';
import { useAuth } from '@/modules/auth';
import { subscribeToRealtime, unsubscribeFromRealtime } from '@/modules/sync';

export function RealtimeProvider({ children }) {
    const { session } = useAuth();

    useEffect(() => {
        if (session?.userId) {
            // Subscribe when authenticated
            subscribeToRealtime();

            return () => {
                // Cleanup on logout or unmount
                unsubscribeFromRealtime();
            };
        }
    }, [session?.userId]);

    return children;
}
```

### Phase 2: Register Event Handlers

**File:** `src/shared/components/RealtimeProvider.tsx` (continued)

```typescript
import { onIncomingWeave, onIncomingLink } from '@/modules/sync';
import { useUIStore } from '@/shared/stores/uiStore';
import { database } from '@/db';
import Friend from '@/db/models/Friend';

useEffect(() => {
    if (!session?.userId) return;

    // Handle incoming shared weaves
    const cleanupWeave = onIncomingWeave(async (payload) => {
        // Show notification/toast
        useUIStore.getState().showToast({
            message: 'New shared weave received!',
            type: 'info'
        });

        // Optionally trigger a refetch of pending weaves
        // queryClient.invalidateQueries(['pending-weaves']);
    });

    // Handle incoming link requests
    const cleanupLink = onIncomingLink(async (payload) => {
        // Update local friend if exists
        const friend = await findFriendByLinkedUserId(payload.user_a_id);
        if (friend) {
            await database.write(async () => {
                await friend.update(f => {
                    f.linkStatus = 'pending_received';
                    f.serverLinkId = payload.id;
                });
            });
        }

        // Show notification
        useUIStore.getState().showToast({
            message: 'New link request received!',
            type: 'info'
        });

        // Update badge count
        // Could emit UIEventBus event or update store
    });

    return () => {
        cleanupWeave();
        cleanupLink();
    };
}, [session?.userId]);
```

### Phase 3: Handle UPDATE Events (Currently Missing)

**Problem:** The current realtime service only listens for `INSERT` events, not `UPDATE`.

When someone **accepts** your link request:
- The `friend_links` row is **updated** (status: pending → accepted)
- This is an UPDATE, not INSERT, so we don't catch it

**Solution:** Add UPDATE subscriptions:

```typescript
// In realtime.service.ts
realtimeChannel = client
    .channel('user-notifications')
    // Existing INSERT handlers...
    .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_links',
            filter: `user_a_id=eq.${user.id}`, // When WE sent the request
        },
        (payload) => {
            // Our outgoing request was accepted/declined
            handleOutgoingLinkStatusChange(payload.new);
        }
    )
    .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'shared_weave_participants',
            // When someone responds to a weave we shared
        },
        (payload) => {
            handleParticipantResponse(payload.new);
        }
    )
    .subscribe();
```

### Phase 4: Integration Points

1. **AppProviders.tsx** - Add `RealtimeProvider` to the provider tree
2. **UIEventBus** - Emit events for non-React code to trigger UI updates
3. **Badge Counts** - Update pending request counts in real-time
4. **Toast Notifications** - Show inline notifications for events

### Phase 5: Testing & Fallback

1. **Keep polling as fallback** - Realtime can fail; polling ensures eventual consistency
2. **Test reconnection** - Verify exponential backoff works correctly
3. **Test offline → online** - Ensure subscription recovers after network loss
4. **Monitor connection status** - Log/track realtime connection health

## Estimated Effort

| Task | Complexity | Notes |
|------|------------|-------|
| Wire up subscription lifecycle | Low | ~30 min |
| Register basic event handlers | Medium | ~1 hour |
| Add UPDATE event subscriptions | Medium | ~1 hour |
| Integrate with UI (toasts, badges) | Medium | ~2 hours |
| Testing & edge cases | High | ~3 hours |

**Total: ~1 day of focused work**

## Files to Modify

1. `src/modules/sync/services/realtime.service.ts` - Add UPDATE handlers
2. `src/shared/components/AppProviders.tsx` - Add RealtimeProvider
3. `src/modules/sync/index.ts` - Export new functions
4. (New) `src/shared/components/RealtimeProvider.tsx` - Subscription lifecycle

## Dependencies

- Supabase Realtime must be enabled for `friend_links` and `shared_weave_participants` tables
- Check `supabase/sharing_schema.sql` comment at bottom:
  ```sql
  -- Enable realtime separately in Supabase Dashboard:
  -- 1. Go to Database > Replication
  -- 2. Enable for tables: friend_links, shared_weave_participants
  ```

## Risks

1. **Realtime quota** - Supabase has connection limits; monitor usage
2. **Battery drain** - Persistent connections can drain battery on mobile
3. **Complexity** - More moving parts = more potential for bugs
4. **Race conditions** - Realtime + polling could cause duplicate updates (dedupe needed)
