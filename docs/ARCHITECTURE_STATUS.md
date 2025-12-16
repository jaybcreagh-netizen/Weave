# Architecture Status Report

**Date:** December 15, 2025
**Version:** 1.0.0

## 1. Executive Summary

The WeaveNative application is currently in a "hybrid" architectural state. It is actively migrating from a monolithic, "God Component" structure (centered around `app/_layout.tsx` and global stores) to a **Feature-Based Modular Architecture**.

While the directory structure (`src/modules/*`) largely reflects the target architecture, the *implementation details* lag behind. Key violations include circular dependencies between core modules, persistence of legacy state management (Zustand), and deep imports that bypass module boundaries.

| Metric | Status | Details |
| :--- | :--- | :--- |
| **Modularization** | 🟡 Partial | Modules exist but share tight coupling via deep imports. |
| **State Strategy** | 🔴 Split | Competition between WatermelonDB (Reactive) and Zustand (Imperative). |
| **Performance** | 🟠 At Risk | Critical N+1 query patterns partially fixed, but risks remain in "Undo" logic. |
| **Styling** | 🟡 Hybrid | `NativeWind` adoption is high, but 68 files still use legacy `StyleSheet`. |

---

## 2. Ideal vs. Current Architecture

### 2.1 Module Boundaries

**The Ideal:**
*   **Encapsulation:** Modules (e.g., `interactions`, `intelligence`) expose a single public API (`index.ts`).
*   **Communication:** Cross-module communication happens via:
    1.  **Public API:** Explicitly exported services/types.
    2.  **Event Bus:** For decoupling side-effects (e.g., `intelligence` listening for `interaction:created`).
*   **No Deep Imports:** Importing `src/modules/A/services/internal.ts` from Module B is forbidden.

**The Reality:**
*   **Deep Imports:** Widespread violations found.
    *   `src/modules/interactions/store/interaction.store.ts` imports directly from `@/modules/intelligence/services/orchestrator.service`.
    *   `src/modules/relationships/components` imports directly from `@/modules/groups/components`.
*   **Circular Dependency:** `interactions` module depends on `intelligence` for scoring, while `intelligence` tests depend on `interactions` for setup. This creates a fragile cycle that complicates testing and refactoring.

### 2.2 Data & State Management

**The Ideal:**
*   **Single Source of Truth:** WatermelonDB is the *only* source of truth.
*   **Reactive UI:** Components use `withObservables` or `useQuery` (React Query) to subscribe directly to the DB.
*   **No Duplication:** Stores (if they exist) only handle UI state (e.g., `isModalOpen`), not data caching.

**The Reality:**
*   **Split Brain:** `src/modules/interactions/store/interaction.store.ts` (Zustand) manually subscribes to WatermelonDB and duplicates the data into a local array (`interactions: []`).
*   **Risk:** This pattern introduces synchronization bugs where the UI might show stale data if the Zustand subscription lags or fails, defeating the purpose of WatermelonDB's reactivity.

### 2.3 Performance Patterns

**The Ideal:**
*   **O(1) / Batch Operations:** All database reads in loops are batched.
*   **Write-Optimized:** Heavy calculations happen asynchronously or in background threads.

**The Reality:**
*   **Optimization Success:** `processWeaveScoring` in `orchestrator.service.ts` successfully implements batching (chunk size 900) to avoid N+1 queries during scoring.
*   **Remaining Risk:** `recalculateScoreOnDelete` contains a query inside a loop (`await database.get('interactions').query(...)`) when handling "Undo" for group interactions. This could cause UI freezes when deleting large group events.
*   **Startup Cost:** `suggestion-provider.service.ts` performs a heavy "Batch Load" of friends and interactions on startup (`console.time('fetchSuggestions:batch_load')`). While partially optimized, it loads data for *all* friends into memory maps, which may scale poorly with 500+ friends.

---

## 3. Directory Structure Status

The file structure is cleaning up well. `src/components` (the old "God Folder") has been successfully distributed into modules.

```
src/
├── modules/
│   ├── auth/          # ✅ Centralized Auth & Sync
│   ├── intelligence/  # ⚠️ Logic heavy, tightly coupled to interactions
│   ├── interactions/  # ⚠️ Contains legacy Zustand store
│   ├── relationships/ # ✅ Clean separation of Friend/Group logic
│   └── ...
├── shared/
│   ├── components/    # Reusable UI primitives
│   ├── types/         # Shared DTOs (Scoring types moved here ✅)
│   └── utils/         # Pure functions
└── db/                # Database Schema & Models
```

## 4. Recommendations for Next Sprint

1.  **Break the Cycle:** Introduce `src/shared/events/event-bus.ts` usage to decouple `interactions` from `intelligence`. Instead of calling `processWeaveScoring` directly, emit an event.
2.  **Kill the Zombie Store:** Refactor `interaction.store.ts` to remove the `interactions` array. Components should query the DB directly.
3.  **Strict Enforcements:** Add an ESLint rule to forbid imports matching `@/modules/*/services/*` from other modules.
