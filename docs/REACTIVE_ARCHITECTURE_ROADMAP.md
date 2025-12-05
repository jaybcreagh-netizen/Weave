# Roadmap: Reactive Architecture Migration

## Overview
This roadmap outlines the 15-step plan to migrate the Weave application from a Store-based data architecture to a Reactive (WatermelonDB-native) architecture. This changes the app from "Pull-then-Push" (Store fetches DB -> Pushes to UI) to "Push" (DB Pushes directly to UI).

**Goal**: Eliminate UI "hanging" and improve perceived performance by removing the Zustand middleman for persistent data.

## Phase 1: Foundation (Reactive Components)
In this phase, we build the reactive primitives that will replace the store.

- [ ] **Step 1: Create `FriendTierList` Component**
    - Create `src/modules/relationships/components/FriendTierList.tsx`.
    - This component will accept a `tier` prop.
    - It will use `withObservables` to query the `friends` table filtered by that tier.
    - **Deliverable**: A self-contained list component that updates automatically.

- [ ] **Step 2: Create `ReactiveWidgetBase` Component**
    - Create a HOC or wrapper for dashboard widgets.
    - Ensure widgets like "Total Weaves" or "Streaks" observe the `UserProgress` table directly.
    - **Deliverable**: Generic reactive wrapper for widgets.

- [ ] **Step 3: Create `ReactiveFriendProfile` primitive**
    - Create a wrapper for the profile screen that takes a `friendId`.
    - Uses `withObservables` to fetch the specific `Friend` record.
    - **Deliverable**: A profile container that auto-updates when the friend model changes.

- [ ] **Step 4: Audit & Update `FriendListRow`**
    - Verify `FriendListRow` is optimally observing only the fields it needs.
    - Ensure it does *not* depend on any parent-passed state other than the `Friend` model itself.
    - **Deliverable**: Optimized row component.

## Phase 2: Screen Migration (The "Switch")
We replace the screens one by one to use the new components.

- [ ] **Step 5: Refactor `app/_friends.tsx` (Friends Screen)**
    - Replace the manual filtering/sorting logic in the component body.
    - Replace the `FlashList` with 3 instances of `FriendTierList` (one for each tier).
    - Remove `useFriends()` hook usage from this file.
    - **Deliverable**: The "Circle" tab becomes fully reactive.

- [ ] **Step 6: Refactor `app/dashboard.tsx` (Home Screen)**
    - Identify any dependency on `useRelationshipsStore` (e.g., badge counts).
    - Replace with a small reactive component (e.g. `<UnreadInsightsBadge />`) that observes the DB.
    - **Deliverable**: Dashboard renders independently of the friend list size.

- [ ] **Step 7: Refactor `app/friend-profile.tsx`**
    - Replace the store selector `activeFriend` with the `ReactiveFriendProfile` wrapper.
    - Ensure the profile uses the URL param `friendId` to mount the observable.
    - **Deliverable**: Profile screen loads instantly and updates on edit.

- [ ] **Step 8: Refactor `app/edit-friend.tsx`**
    - Similar to profile, ensure the form hydrates from a direct DB observation or a direct fetch, rather than the store.
    - **Deliverable**: Edit form is decoupled from the global store.

- [ ] **Step 9: Refactor `FriendForm` (Submission Logic)**
    - Verify that `createFriend` writes to DB (already done).
    - **Critical**: Remove any code that manually calls `store.addFriend` or `store.updateFriend`.
    - Trust the DB observation to update the UI.
    - **Deliverable**: "Fire and forget" form submission.

## Phase 3: Store Deprecation (Removing the Legacy)
Now that the UI doesn't need the store, we strip it down.

- [ ] **Step 10: Remove `friends` Array from Store**
    - Edit `src/modules/relationships/store.ts`.
    -  Delete the `friends` state property.
    - Delete `observeFriends` and `unobserveFriends` actions.
    - **Deliverable**: `useRelationshipsStore` no longer holds the friend list.

- [ ] **Step 11: Remove `activeFriend` from Store**
    - Delete `activeFriend` state property.
    - Delete `observeFriend` action.
    - **Deliverable**: Store no longer tracks "currently viewed friend" (URL params handle this).

- [ ] **Step 12: Remove `activeFriendInteractions` from Store**
    - Delete `activeFriendInteractions` array.
    - Delete the complex nested observation logic for interactions.
    - Replace with a `InteractionList` component that uses `withObservables` locally.
    - **Deliverable**: Store is significantly lighter.

- [ ] **Step 13: Deprecate `useFriends` Hook**
    - Update `src/modules/relationships/hooks/useFriends.ts`.
    - Add `@deprecated` JSDoc tag.
    - Change implementation to throw a warning if used, or strip it entirely if no usages remain.
    - **Deliverable**: Clean codebase signal.

## Phase 4: Verification & Polish
- [ ] **Step 14: Search & Destroy "Prop Drilling"**
    - Scan codebase for places where `friend` objects are passed down 3+ levels.
    - Replace with `friendId` passing + `withObservables` at the leaf node.
    - **Deliverable**: Cleaner component hierarchy.

- [ ] **Step 15: Final Manual Regression Test**
    - Add a friend -> Verify it appears in list immediately.
    - Edit a friend -> Verify list updates immediately.
    - Delete a friend -> Verify it vanishes immediately.
    - **Deliverable**: Signed-off release candidate.
