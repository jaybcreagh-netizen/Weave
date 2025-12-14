# Architecture Audit & Refactoring Plan
**Date:** December 14, 2025
**Scope:** Architecture, Import Graph, Performance, Code Quality

---

## 1. Executive Summary

The WeaveNative codebase has adopted a modular architecture (`src/modules/*`), which is a strong foundation. However, implementation details have drifted, leading to **Circular Dependencies** between core modules (`intelligence` <-> `interactions`) and **Performance Bottlenecks** (N+1 queries) in critical paths.

The "Single Source of Truth" strategy is partially compromised by the persistence of legacy `zustand` stores alongside the modern `WatermelonDB + React Query` stack.

### Key Findings
| Category | Issue | Severity | Status |
|----------|-------|----------|--------|
| **Performance** | N+1 Query Loop in `orchestrator.service.ts` | **Critical** | 🔴 Unresolved |
| **Architecture** | Circular Dependency (`intelligence` ↔ `interactions`) | **High** | 🔴 Persistent |
| **State** | Split State Management (`zustand` vs `WatermelonDB`) | **Medium** | 🟠 Legacy Debt |
| **Styling** | Hybrid Sytling (`StyleSheet` mixed with `NativeWind`) | **Low** | 🟠 In Progress |

---

## 2. Detailed Audit Warnings

### 2.1 Critical Performance Bottleneck (N+1 Query)
**Location:** `src/modules/intelligence/services/orchestrator.service.ts` (Lines 94-112)
**Function:** `processWeaveScoring`

**The Pattern:**
```typescript
for (const friend of friends) {
  // AWAITS inside a loop = Serial Execution
  const interactionFriends = await database.get('interaction_friends').query(...).fetch();
  // ... another await ...
}
```
**Impact:**
When recalculating scores for `N` friends, this triggers `2 * N` asynchronous database calls *before* the write transaction begins. For a user with 150 friends, this results in 300 serial DB round-trips, causing noticeable UI lag/freezes during "Recalculate All" or bulk updates.

**Recommended Fix:**
Use raw SQL queries or optimized WatermelonDB batching to fetch all required `interaction_friends` and counts in a single (or few) queries *before* the loop.

### 2.2 Circular Dependencies (Module Coupling)
The `intelligence` module (Business Logic) and `interactions` module (Feature) are tightly coupled.

1.  **Intelligence depends on Interactions:**
    *   `src/modules/intelligence/services/orchestrator.service.ts` imports `InteractionFormData` from `@/modules/interactions`.
2.  **Interactions depends on Intelligence:**
    *   `src/modules/interactions/services/plan.service.ts` imports `processWeaveScoring` from `@/modules/intelligence`.
    *   `src/modules/interactions/services/guaranteed-suggestions.service.ts` imports `calculateCurrentScore` from `@/modules/intelligence`.

**Why this is bad:**
It makes the modules inseparable. You cannot test `intelligence` logic without pulling in the `interactions` machinery, and vice-versa. It often leads to "require cycles" warnings in React Native.

**Recommended Fix:**
Extract shared data definitions (like `InteractionFormData` or a generic `ScoringInputDTO`) to `@/shared/types` or a dedicated `@/domain` layer. `intelligence` should operate on generic interfaces, not `interactions` specific classes.

### 2.3 Legacy State Management
Usage of `zustand` persists in:
*   `src/stores/` (global UI stores)
*   `src/modules/auth/store/`
*   `src/modules/interactions/store/`

This competes with the reactive WatermelonDB architecture. New features should strictly avoid `zustand` in favor of React Query (for server/derived state) or WatermelonDB Observables (for local persistent state).

### 2.4 Hybrid Styling
Approx. **70 files** still use `StyleSheet.create`, while the codebase standard is `NativeWind` (`className`). This leads to inconsistent theming, especially for Dark Mode support, as `StyleSheet` styles usually hardcode colors or use complex hook logic vs. simple utility classes.

---

## 3. Refactoring Plan

This plan prioritizes stability and performance (Phase 1) before moving to architectural cleanup (Phase 2) and debt repayment (Phase 3).

### Phase 1: Critical Performance & Stability (Immediate)
**Goal:** Eliminate application freezes and potential crashes.

- [ ] **Fix N+1 Query in `orchestrator.service.ts`**
    *   **Action:** Refactor `processWeaveScoring`.
    *   **Implementation:** pre-fetch all needed `interaction_friends` entries for the list of friend IDs in one go using `Q.oneOf(friendIds)`. Map them in memory.
    *   **Verify:** Benchmark `processWeaveScoring` with 100 friends. Time should drop from ~Seconds to ~Milliseconds.

- [ ] **Fix Type Safety in `Friend.ts`** (from previous audit, still relevant risk)
    *   Ensure `dunbarTier` getters handle nulls gracefully to prevent runtime errors.

### Phase 2: Architectural Decoupling (High Priority)
**Goal:** Break the circular dependency chain.

- [ ] **Extract Scoring DTOs**
    *   **Action:** Create `src/shared/types/scoring.types.ts` (or similar).
    *   **Move:** derived types like `InteractionFormData` or create a compliant interface `ScorableInteraction` there.
    *   **Refactor:** Update `intelligence` service to import from `shared/types`. Update `interactions` to implement that interface.
    *   **Result:** `intelligence` no longer depends on `interactions`.

### Phase 3: Technical Debt Repayment (Ongoing)
**Goal:** Standardize codebase patterns.

- [ ] **Zustand Migration (Pilot)**
    *   Target: `src/modules/interactions/store/event-suggestion.store.ts`
    *   Action: Convert to a React Query `useQuery` or `useMutation` hook if it manages async data, or a clear Context if it's UI state.

- [ ] **StyleSheet Eradication**
    *   Target: `src/components/SuggestionCard.tsx` and `ArchetypeCard.tsx`.
    *   Action: Convert `styles.container` -> `className="p-4 bg-card rounded-lg ..."`.
    *   Note: Use `render_diffs` tool to verify visual parity.

## 4. Architectural Rules (New)
1.  **One-Way Dependency Flow:** `Features (Interactions)` -> `Business Logic (Intelligence)` -> `Shared (Types/Utils)`.
2.  **No Loops in Logic:** Do not `await` inside `for` loops. Use `Promise.all` or Batch fetching.
3.  **Strict Public API:** Only import from `@/modules/X` (root index). Never `@/modules/X/services/Y`.
