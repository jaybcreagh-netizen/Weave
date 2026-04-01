# Technical Debt & Known Bugs

**Date:** December 15, 2025
**Status:** Active Analysis

---

## 1. Critical Bugs (High Severity)

### 🐛 Potential N+1 in "Undo" Logic
**Location:** `src/modules/intelligence/services/orchestrator.service.ts` -> `recalculateScoreOnDelete`
**Issue:**
When deleting an interaction (e.g., "Undo" action), the code iterates through all involved friends. Inside this loop, if the interaction was the "latest" one, it performs an async database query to find the *previous* interaction to restore the `lastUpdated` date.
**Impact:**
Deleting a group event with 20 friends triggers 20 serial DB queries. This can freeze the UI for several seconds.
**Fix:**
Pre-fetch the "second latest" interaction for all affected friends in a single batch query before entering the loop.

### 🐛 Split State Synchronization
**Location:** `src/modules/interactions/store/interaction.store.ts`
**Issue:**
This Zustand store manually subscribes to WatermelonDB queries and copies the results into a local `interactions` array.
**Impact:**
1.  **Memory Overhead:** Double storage of data (DB + JS Heap).
2.  **Race Conditions:** If the component unmounts or the subscription lags, the UI shows stale data even if the DB has updated.
3.  **Complexity:** Requires manual `observe` / `unobserve` lifecycle management which is error-prone.

---

## 2. Technical Debt (Code Quality)

### ⚠️ Type Safety Gaps
**Count:** ~12 instances of `: any` in Database Models.
**Details:**
Files in `src/db/models` (specifically `Friend.ts` and migrations) cast query results to `any`. This bypasses TypeScript's safety, leading to potential runtime crashes if DB schema changes (e.g., accessing a renamed column).
**Recommendation:**
Define strict interfaces for all raw SQL query results and `unsafeExecuteSql` calls.

### ⚠️ Hybrid Styling System
**Count:** 68 files using `StyleSheet.create`.
**Details:**
The project has committed to **NativeWind** (Tailwind CSS for React Native), but ~20% of the UI components still use the legacy `StyleSheet` API.
**Impact:**
*   **Inconsistent Theming:** Harder to support Dark Mode globally when styles are hardcoded in JS objects.
*   **Maintenance Overhead:** Developers must switch context between two styling paradigms.
**Recommendation:**
Migrate 5-10 files per sprint to NativeWind classes.

### ⚠️ Deep Module Imports
**Details:**
Modules frequently import private implementation details from other modules.
*   `interactions` imports `orchestrator.service` directly.
*   `relationships` imports `groups/components` directly.
**Impact:**
Refactoring a service internals (e.g., renaming a function in `orchestrator`) breaks unrelated modules. It violates the "Public API" architectural rule.

### ⚠️ Heavy Startup "Batch Load"
**Location:** `src/modules/interactions/services/suggestion-provider.service.ts`
**Details:**
The `fetchSuggestions` function loads all friends and their recent interactions into memory maps (`interactionsByFriendId`) on every call (or app start).
**Impact:**
While currently fast enough, this is O(N) with the number of friends. As a user's network grows to Dunbar's limit (150+), this will noticeably slow down the "Suggestions" tab load time.

---

## 3. Maintenance Tasks

*   [ ] **ESLint Rules:** Configure `no-restricted-imports` to ban cross-module deep imports.
*   [ ] **Test Coverage:** Critical scoring logic in `intelligence` relies on complex integration tests. Add more granular unit tests for `scoring.service.ts` that don't require a full DB mock.
*   [ ] **Unused Code:** Verify if `src/shared/events/event-bus.ts` is actually used. If not, implement it to solve the circular dependency issue, or delete it.
