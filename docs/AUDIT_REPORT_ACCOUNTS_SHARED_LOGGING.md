# Audit Report: Accounts System & Shared Logging

**Date:** December 2024
**Scope:** `src/modules/auth`, `src/modules/sync`, `SharedWeaveRef`, `SyncEngine`
**Reviewer:** Jules

---

## 1. Executive Summary

This audit reviewed the implementation of the new Accounts System and Shared Logging (Shared Weaves) features. The core finding is that while the functional requirements are largely met, the architecture suffers from a confusing split between two "Sync Engines" that needs immediate refactoring. Additionally, critical performance risks exist in the offline queue processing and relationship scoring logic.

## 2. Refactoring (High Priority)

### Finding 2.1: Dual Sync Engine Ambiguity
**Priority:** 🔴 **High**
**Location:** `src/modules/auth/services/sync-engine.ts` vs `src/modules/sync/services/sync-engine.service.ts`

**Issue:**
The codebase contains two distinct services with nearly identical names but overlapping yet distinct responsibilities, leading to architectural confusion and potential race conditions.
*   **Engine A (`auth/.../sync-engine.ts`):** A class-based engine handling "Full Data Replication" (CRUD sync for tables like `friends`, `interactions`).
*   **Engine B (`sync/.../sync-engine.service.ts`):** A functional service handling the "Offline Action Queue" (shared weaves, link requests).

**Recommendation:**
Consolidate sync logic into the `src/modules/sync` module and explicitly rename services to reflect their role:
1.  **Move** `src/modules/auth/services/sync-engine.ts` to `src/modules/sync/services/data-replication.service.ts`.
2.  **Rename** `src/modules/sync/services/sync-engine.service.ts` to `src/modules/sync/services/action-queue.service.ts`.
3.  **Refactor** `src/modules/auth/index.ts` to export these from the new location, or update consumers to import from `@/modules/sync`.

---

## 3. Logic & Performance

### Finding 3.1: Unbounded Offline Queue Processing (Memory Leak Risk)
**Priority:** 🔴 **High**
**Location:** `src/modules/sync/services/sync-engine.service.ts` -> `processQueue()`

**Issue:**
The `processQueue` function fetches *all* pending items (`fetch()`) without pagination.
```typescript
const pendingItems = await queueCollection
    .query(Q.where('status', 'pending'), Q.sortBy('queued_at', Q.asc))
    .fetch();
```
If a user is offline for a long period and generates hundreds of actions, this could cause an Out-Of-Memory (OOM) crash upon reconnection.

**Recommendation:**
Implement batch processing (e.g., fetch 50 items at a time).

### Finding 3.2: N+1 Query in Interaction Updates
**Priority:** 🟠 **Medium**
**Location:** `src/modules/interactions/services/interaction.actions.ts` -> `updateInteraction`

**Issue:**
When updating an interaction, the code iterates through all associated friends and recalculates scores sequentially using `await` inside a loop:
```typescript
for (const iFriend of interactionFriends) {
    await recalculateScoreOnEdit(iFriend.friendId, ...);
}
```
For group interactions (e.g., 10+ friends), this blocks the UI thread significantly.

**Recommendation:**
Refactor `recalculateScoreOnEdit` to accept an array of friend IDs and perform bulk updates, or wrap the loop in `database.write()` with batched operations.

### Finding 3.3: Sync Engine Race Conditions
**Priority:** 🟠 **Medium**
**Location:** Global
**Issue:**
The two sync engines operate independently. It is possible for the `ActionQueue` to try to update a Shared Weave while the `DataReplication` engine is simultaneously overwriting the local record from a server pull.

**Recommendation:**
Implement a `SyncCoordinator` service that manages the lifecycle of both engines, ensuring they do not run write operations simultaneously.

---

## 4. Security & Privacy

### Finding 4.1: Privacy-Preserving Shared Weaves
**Priority:** 🟢 **Low (Positive)**
**Location:** `src/modules/sync/services/sync-operations.ts`

**Observation:**
The implementation of `executeShareWeave` correctly extracts only logistics (title, date, location, category) from the interaction. Private data such as `reflections`, `vibe`, and personal `notes` are **not** included in the payload sent to Supabase. This aligns perfectly with the "Calendar Invite" privacy model.

### Finding 4.2: Missing RLS Verification
**Priority:** 🟠 **Medium**
**Location:** Database Migrations

**Issue:**
While the design document specifies Row Level Security (RLS) policies, I cannot verify the active policies on the remote Supabase instance.
**Recommendation:**
Ensure `supabase/migrations` contains explicit SQL to enable RLS on `shared_weaves` and `shared_weave_participants`.

---

## 5. UX/UI Flow

### Finding 5.1: Onboarding Auth Flow
**Priority:** 🟢 **Low**
**Location:** `src/modules/onboarding/screens/OnboardingScreen.tsx`

**Observation:**
The flow correctly checks `FeatureFlags.ACCOUNTS_ENABLED` before routing to `OnboardingAuth`. This ensures a safe rollout. The UI is consistent with the design system (Lora font, FadeInDown animations).

---

## 6. Integration Gaps

### Finding 6.1: Missing Shared Event Observability
**Priority:** 🟠 **Medium**
**Location:** `src/shared/utils/Logger.ts`

**Issue:**
Sentry is integrated for errors, but there is no dedicated logging for "Shared Event Success/Failure" rates. It will be difficult to debug if Shared Weaves are failing silently for specific users.

**Recommendation:**
Integrate a structured logging call (e.g., `Analytics.track('Shared Weave Created')`) in `executeShareWeave` and `executeAcceptWeave`.

### Finding 6.2: OAuth Integration
**Priority:** 🟢 **Low**
**Observation:**
Apple and Google Sign-In are implemented in `supabase-auth.service.ts`. The implementation looks standard and correct for Expo/React Native.

---

## 7. Summary of Action Items

1.  **Refactor:** Move and rename Sync Engines (`DataReplicationService`, `ActionQueueService`).
2.  **Fix:** Add pagination to `processQueue` in `sync-engine.service.ts`.
3.  **Optimize:** Batch score recalculations in `InteractionActions`.
4.  **Verify:** Check `supabase/migrations` for RLS policies.
5.  **Monitor:** Add analytics tracking for Shared Weave success rates.
