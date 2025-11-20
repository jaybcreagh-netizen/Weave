# Weave Refactor Recovery Plan (v3.0)

**Status:** Critical Path Correction
**Date:** 2025-11-17
**Objective:** Fix the split-brain state of the codebase (Lib vs Modules) and complete the transition.

## 🚨 Current State Assessment

We are currently in a **"Split Brain" state**:
- **Structure:** Modules exist in `src/modules/` (Good).
- **Logic:** Core logic still lives in `src/lib/` (Bad).
- **Consumers:** Components and Hooks are still importing from `src/lib/` (Bad).
- **Violations:** New modules (`relationships`) are importing back into `src/lib/` (Critical Violation).

**Missing Pieces:**
- `Insights` module does not exist.
- `Notifications` module does not exist.
- `Friend` model is still "fat" (contains business logic properties).

---

## 🛠 Recovery Phases

### Phase R1: Gamification Migration Completion
**Goal:** Make `src/modules/gamification` the SINGLE source of truth.

1.  **Audit:** Verify `src/modules/gamification` has 100% feature parity with `src/lib/badge-tracker.ts` and `src/lib/achievement-tracker.ts`.
2.  **Switch Consumers:**
    - Update `src/components/BadgeUnlockModal.tsx` to import from `@/modules/gamification`.
    - Update `src/components/FriendBadgeSection.tsx` to import from `@/modules/gamification`.
    - Update `src/stores/uiStore.ts` to import from `@/modules/gamification`.
3.  **Deprecate:** Rename `src/lib/badge-tracker.ts` to `src/lib/badge-tracker.deprecated.ts`.
4.  **Verify:** Run app and check badges.

### Phase R2: Intelligence Migration Completion
**Goal:** Kill `src/lib/weave-engine.ts` (or its remnants).

1.  **Audit:** Ensure `src/modules/intelligence` exports `calculateScore`, `decay`, etc.
2.  **Switch Consumers:**
    - Update `src/stores/interactionStore.ts` (if not already done).
    - Update `src/components/TimelineItem.tsx`.
3.  **Verify:** Scores update correctly.

### Phase R3: Insights Module Creation
**Goal:** Move `pattern-analyzer.ts`, `feedback-analyzer.ts`, `reciprocity-analyzer.ts`.

1.  **Scaffold:** Create `src/modules/insights`.
2.  **Migrate:** Move logic from `src/lib/*-analyzer.ts` to `src/modules/insights/services/`.
3.  **Switch Consumers:** Update `useEffectiveness`, `useReciprocity`, `useTrendsAndPredictions`.

### Phase R4: Legacy Lib Cleanup
**Goal:** Empty `src/lib` of all migrated logic.

1.  **Aggressive Migration:** Move remaining utils to `src/shared/utils` or specific modules.
2.  **Delete:** Remove deprecated files.

### Phase R5: Strict Boundary Enforcement
**Goal:** Prevent regression.

1.  **ESLint:** Configure `no-restricted-imports` to ban `../lib/*` from within modules.
2.  **ESLint:** Ban importing from `src/modules/*/services/*` directly (must use `index.ts`).

---

## 📋 Immediate Action Items (Next 24 Hours)

1.  **Fix `src/modules/relationships`**: It imports `../lib/milestone-tracker`. This creates a circular dependency risk. Move `milestone-tracker` logic to `gamification` (where it belongs) or `relationships` immediately.
2.  **Consolidate Badges**: We have duplicate definitions in `lib` and `modules`. Delete the `lib` definitions and point everything to `modules`.
