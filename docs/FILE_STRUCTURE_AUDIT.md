# File Structure Audit & Refactoring Plan

**Date:** December 14, 2025
**Scope:** File Structure, Domain Boundaries, Scalability

---

## 1. Executive Summary

The WeaveNative codebase is currently in a transitional state between a flat, component-heavy structure and a modern domain-driven modular architecture.

While the `src/modules` directory implements a solid Domain-Driven Design (DDD) pattern, the persistence of a legacy `src/components` "God folder" creates significant ambiguity. This directory acts as mixed bag of generic UI, feature-specific logic, and full-screen modals. Additionally, the `app/` directory contains several "fat routes" that mix routing logic with complex UI implementation.

To achieve a robust, scalable, and testable system, the codebase must complete the migration to the Modular Architecture, effectively eliminating `src/components` and thinning out the `app/` directory.

---

## 2. Findings

### 2.1 The `src/components` "God Folder"
**Status:** 🔴 Critical Structural Debt
**Contains:** ~73 files + subdirectories
**Issues:**
*   **Mixed Responsibilities:** Contains everything from primitive UI (which belongs in `shared/ui`) to complex business logic (which belongs in `modules`).
*   **Domain Leaks:**
    *   `FriendSelector.tsx`, `FriendBadgePopup.tsx` → Belongs in `modules/relationships`
    *   `EditInteractionModal.tsx`, `LogInteractionFlow` → Belongs in `modules/interactions`
    *   `ArchetypeCard.tsx`, `SeasonExplanationModal.tsx` → Belongs in `modules/intelligence` or `modules/gamification`
*   **Discoverability:** Developers cannot predict if a component is in `src/modules/X/components` or `src/components`.

### 2.2 The `src/shared` Ambiguity
**Status:** 🟠 Underutilized
**Observation:**
*   `src/shared/ui`: Correctly contains design system primitives (`Button`, `Text`, `Card`). This is good.
*   `src/shared/components`: Only contains 3 files. Most "shared" business-aware components are incorrectly sitting in `src/components`.

### 2.3 `app/` Directory Bloat
**Status:** 🟠 High Coupling
**Observation:** Standard "Expo Router" best practices suggest `app/` files should be thin wrappers.
**Violations:**
*   `app/weave-logger.tsx` (**25KB**): Contains massive amounts of inline logic, state management, and UI layout.
*   `app/friend-profile.tsx` (**10KB**): Heavy component logic coupled with routing.
*   `app/_friends.tsx` (**15KB**): Tab layout containing logic.
**Impact:** These "fat routes" are hard to unit test because they rely on the routing context. Logic cannot be reused easily.

---

## 3. Structural Recommendations

### 3.1 Architecture: The "Module-First" Policy
We should adopt a strict rule: **`src/components` should not exist.**

Every component must define its "home" based on the following decision tree:
1.  Is it a **Design System Primitive** (Button, Input)? → `src/shared/ui`
2.  Is it **Generic but Complex** (Loader, ErrorBoundary)? → `src/shared/components`
3.  Is it **Feature Specific**? → `src/modules/[FeatureName]/components`
4.  Is it a **Full Screen**? → `src/modules/[FeatureName]/screens`

### 3.2 Standardization: Module Anatomy
Every module in `src/modules/` should follow this exact structure to ensure predictability:

```text
src/modules/[module-name]/
├── components/      # UI components (dumb or smart)
├── screens/         # Page-level components (exported for app/)
├── hooks/           # Encapsulated state logic
├── services/        # Pure business logic / Database interactions
├── store/           # (Optional) React Query hooks or legacy stores
├── types/           # Module-specific TS interfaces
└── index.ts         # Public API (Strict boundaries)
```

### 3.3 Standardization: Testing Strategy
*   **Unit Tests (`.test.ts`)**: Focus on `services/` (business logic) and `hooks/`.
*   **Component Tests (`.test.tsx`)**: Focus on `components/` using React Native Testing Library.
*   **Screen Tests**: By extracting excessive logic from `app/` to `modules/X/screens/`, we can test screens in isolation without mocking the entire Expo Router stack.

---

## 4. Refactoring Roadmap

This is a step-by-step plan to "dig ourselves out" of the technical debt.

### Phase 1: Dismantle `src/components` (The Migration)
Goal: Empty `src/components` completely.

*   [ ] **Move Relationship Components**
    *   `FriendSelector.tsx`, `AddFriendMenu.tsx`, `FriendBadge*.tsx` → `src/modules/relationships/components/`
*   [ ] **Move Interaction Components**
    *   `EditInteractionModal.tsx`, `PlanChoiceModal.tsx`, `SuggestionCard.tsx` → `src/modules/interactions/components/`
*   [ ] **Move Gamification/Intelligence Components**
    *   `Archetype*.tsx`, `Season*.tsx`, `Achievement*.tsx` → `src/modules/[module]/components/`
*   [ ] **Refactor Imports**: Update all `import ... from '@/components/X'` to their new module paths.

### Phase 2: Slim Down `app/` Routes
Goal: `app/` files should be < 50 lines of code.

*   [ ] **Refactor `weave-logger.tsx`**
    *   Create `src/modules/interactions/screens/WeaveLoggerScreen.tsx`
    *   Move all logic and UI there.
    *   Update `app/weave-logger.tsx` to just import and render `<WeaveLoggerScreen />`.
*   [ ] **Refactor `friend-profile.tsx`**
    *   Create `src/modules/relationships/screens/FriendProfileScreen.tsx`
    *   Migrate code.

### Phase 3: Enforce Boundaries (Linting)
*   [ ] Add `eslint-plugin-boundaries` (or similar configuration) to prevent importing from a module's internals (e.g., `import ... from '@/modules/auth/components/Login'` should be forbidden; only `import ... from '@/modules/auth'` permitted). *Note: This is an advanced step, start with manual discipline first.*
