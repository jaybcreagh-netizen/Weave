# Codebase Audit Report

**Date:** February 26, 2024
**Scope:** Entire Codebase
**Focus:** Architecture, Code Quality, Performance, Styling

---

## 1. Executive Summary

The codebase is currently in a transitional state, moving towards a modular architecture (feature-based modules) and modern state management (React Query + WatermelonDB). While significant progress has been made (e.g., `app/_layout.tsx` refactor, strict token-based styling), there are critical inconsistencies that compromise stability and maintainability.

**Top Critical Risks:**
1.  **Circular Dependencies & Deep Imports:** The `intelligence` module, designed to be pure business logic, has dependencies on `interactions`, creating a circular dependency risk.
2.  **Performance Bottlenecks:** N+1 query patterns were detected in core scoring logic (`orchestrator.service.ts`).
3.  **Type Safety Gaps:** Widespread use of `any` in database models and migrations undermines TypeScript's safety guarantees.
4.  **Inconsistent State Management:** New features compete with legacy `zustand` stores, leading to split sources of truth.

---

## 2. Architecture Inconsistencies

### 2.1 Module Boundary Violations
**Principle:** Modules (e.g., `intelligence`, `interactions`) should only communicate via their public `index.ts` API. Deep imports into another module's internals (e.g., `import ... from '@/modules/interactions/services/...'`) are forbidden.

**Findings:**
*   **Deep Imports:**
    *   `src/modules/intelligence/index.ts` imports from `../interactions/services/suggestion-engine.service`.
    *   `src/modules/notifications/services/notification.service.ts` imports from `../../intelligence`.
    *   `src/modules/intelligence/services/scoring.service.ts` imports from `../../interactions/types`.
*   **Circular Dependency Risk:** The `intelligence` module (Business Logic) depends on `interactions` (Feature Module) for Types. Ideally, `intelligence` should define its own DTOs, and `interactions` should map to them.

### 2.2 State Management
**Principle:** Migrate away from `zustand` to React Query + WatermelonDB Observables.

**Findings:**
*   **Legacy Stores Persist:** `zustand` is still actively used in:
    *   `src/modules/interactions/store.ts`
    *   `src/modules/auth/store/` (multiple files)
    *   `src/stores/` (global UI stores)
*   **Split Truth:** Some components rely on WatermelonDB observables while others likely still subscribe to these Zustand stores, potentially causing UI desync.

---

## 3. Code Quality & Bugs

### 3.1 Type Safety (`any` usage)
**Severity:** High
**Findings:**
*   **Database Models:** `src/db/models` files frequently cast queries to `any` or use `any` for complex aggregations.
*   **Logic Services:** `src/modules/intelligence/services/orchestrator.service.ts` uses `(r: any) => r.interactionId` when mapping relations.
*   **Migrations:** `src/db/data-migration.ts` relies heavily on `any` types.
*   **Specific Issue:** `Friend` model (`src/db/models/Friend.ts`) uses definite assignment (`!`) for `dunbarTier` (string) but exposes a getter `tier` (Enum). If the DB field is null/undefined, this getter logic might fail or return `Community` unexpectedly.

### 3.2 Console Logs in Production
**Severity:** Medium
**Findings:**
*   40+ files contain `console.log` statements.
*   **Critical Locations:**
    *   `src/modules/intelligence/scripts/verify-scoring.ts` (appears to be a script, but check if bundled).
    *   `src/modules/interactions/services/plan.service.ts` (logs business logic flow).
    *   `src/db/data-migration.ts` (verbose logging).
*   **Recommendation:** Replace with `Logger` utility or remove.

---

## 4. Performance

### 4.1 N+1 Query Patterns
**Severity:** High
**Location:** `src/modules/intelligence/services/orchestrator.service.ts`
**Details:**
In `processWeaveScoring`, the code iterates over the `friends` array. Inside the loop, it awaits a database query:
```typescript
for (const friend of friends) {
  const interactionFriends = await database.get('interaction_friends')
    .query(Q.where('friend_id', friend.id)) // <--- N+1 QUERY
    .fetch();
  // ...
}
```
**Impact:** If calculating scores for 150 friends, this triggers 150 separate async DB queries *before* the transaction block, causing significant delay on "Recalculate All" actions.

### 4.2 Styling Performance
**Severity:** Low (Maintenance)
**Findings:**
*   **Hybrid Styling:** 79 files still use `StyleSheet.create`, while the project direction is NativeWind (`className`).
*   **Hardcoded Colors:** Multiple instances of hex codes (`#123456`) in files instead of using design tokens (`src/shared/theme/tokens.ts`).

---

## 5. Recommended Action Plan

1.  **Immediate Fixes (Bugs & Perf):**
    *   Refactor `processWeaveScoring` in `orchestrator.service.ts` to batch fetch `interaction_friends` or use a raw SQL query if WatermelonDB allows, to eliminate the N+1 loop.
    *   Replace `console.log` with `Logger` in `plan.service.ts` and `migration` files.

2.  **Short-term Refactor:**
    *   Remove deep imports in `intelligence` and `notifications`. Move shared types to `src/shared/types` or `src/modules/intelligence/types.ts` to break the dependency on `interactions`.
    *   Fix `Friend` model types to ensure `dunbarTier` is safely handled.

3.  **Long-term Migration:**
    *   Systematically convert `StyleSheet` files to NativeWind.
    *   Migrate `auth` and `interactions` stores from Zustand to React Query.
