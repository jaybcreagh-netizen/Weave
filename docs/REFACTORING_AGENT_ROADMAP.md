# Refactoring Agent Roadmap
**Status:** Planning
**Objective:** Execute the Architecture Audit plan in safe, isolated agent sessions.

This document breaks down the refactoring work into "Agent-Sized Chunks." Each section represents a single, self-contained task that can be given to an AI coding assistant.

---

## Phase 1: Critical Performance (Stop the Bleeding)
**Goal:** Fix the N+1 query bottleneck in `processWeaveScoring` that freezes the UI during bulk updates.

### Task 1.1: Optimize Scoring Loop
**Context:** `src/modules/intelligence/services/orchestrator.service.ts` loops through friends and awaits a DB query for *each one* to get interaction history.
**Target File:** `src/modules/intelligence/services/orchestrator.service.ts`

**Agent Prompt:**
```text
Role: Performance Engineer
Task: Eliminate N+1 Query in Scoring Logic

1. Analyze `processWeaveScoring` in `src/modules/intelligence/services/orchestrator.service.ts`.
2. Identify the loop where `database.get('interaction_friends').query(...)` is awaited for every friend.
3. Refactoring Plan:
   - BEFORE the loop: Query `interaction_friends` for ALL target friend IDs in a single batch.
     - Hint: Use `Q.where('friend_id', Q.oneOf(friendIds))` if using WatermelonDB query builder, or a raw SQL query if necessary for performance.
   - Store results in a generic Map or Dictionary: `Map<FriendId, InteractionCount>`.
   - INSIDE the loop: Lookup the count from the Map instead of querying the DB.
4. Constraints:
   - Do NOT change the scoring math (business logic).
   - Ensure the function signature of `processWeaveScoring` remains unchanged.
   - Preserves existing transaction logic.
```

---

## Phase 2: Architectural Decoupling (Breaking Chains)
**Goal:** Break the circular dependency between `intelligence` and `interactions`.
**Current State:** `Intelligence` imports from `Interactions` (violating dependency flow), and `Interactions` imports from `Intelligence`.

### Task 2.1: Extract Shared Domain Types
**Context:** `InteractionFormData` is defined in `modules/interactions` but required by `intelligence` to calculate scores.
**Target Files:**
-   `src/modules/interactions/types.ts` (Source)
-   `src/shared/types/scoring.types.ts` (New Destination)
-   `src/modules/intelligence/services/orchestrator.service.ts` (Consumer)

**Agent Prompt:**
```text
Role: Software Architect
Task: Extract Shared Scoring Types to Break Circular Dependency

1. Create a new file: `src/shared/types/scoring.types.ts`.
2. Extract the interfaces related to Scoring Inputs from `src/modules/interactions/types.ts`.
   - Specifically look for `InteractionFormData` or equivalent data shapes needed by the scoring engine.
   - If `InteractionFormData` is too coupled to UI, create a new interface `ScoringInput` in shared types.
3. Update `src/modules/interactions/types.ts` to extend or use this new shared type.
4. Update `src/modules/intelligence/services/orchestrator.service.ts`:
   - Change imports to pull from `src/shared/types/scoring.types.ts` instead of `@/modules/interactions`.
5. Verify: Grep for `from '@/modules/interactions'` inside `src/modules/intelligence` to ensure the link is severed.
```

### Task 2.2: Invert Dependency Direction
**Context:** `Interactions` module services directly import `processWeaveScoring` from `Intelligence`. While `Feature -> Logic` is generally okay, we want to ensure `Intelligence` stays pure.
**Target Files:** `src/modules/interactions/services/plan.service.ts`

**Agent Prompt:**
```text
Role: Refactoring Specialist
Task: Verify and Clean Module Imports

1. Access `src/modules/interactions/services/plan.service.ts`.
2. Check imports from `@/modules/intelligence`.
3. Goal: Ensure we are ONLY importing from the public index (`@/modules/intelligence/index.ts`) and NOT deep imports (e.g. `@/modules/intelligence/services/...`).
4. If deep imports exist, refactor them to import from the root module index.
   - If the symbol isn't exported in `index.ts`, export it there first.
```

---

## Phase 3: State Management (Legacy Migration)
**Goal:** Pilot the migration from `zustand` to `React Query` + `WatermelonDB` to unify the source of truth.

### Task 3.1: Event Suggestions Store Migration
**Context:** `src/modules/interactions/store/event-suggestion.store.ts` uses Zustand.
**Target:** Replace this with a React Query hook.

**Agent Prompt:**
```text
Role: React Native State Specialist
Task: Migrate Zustand Store to React Query

1. Analyze `src/modules/interactions/store/event-suggestion.store.ts`.
2. Identify what state acts as a cache (server data) versus what is UI state (isModalOpen).
3. Refactor:
   - For Cached Data (e.g., suggestions list): Create `src/modules/interactions/hooks/useEventSuggestionsQuery.ts` using `@tanstack/react-query`.
   - For UI State (e.g., selected filter): Use local state (`useState`) in the parent component OR a tiny React Context if shared deeply.
   - Delete the Zustand store file.
4. Update consumers: Find components using `useEventSuggestionStore` and switch them to the new hooks.
```

---

## Phase 4: Styling Standardization (UI Hygiene)
**Goal:** Remove `StyleSheet` usage in favor of `NativeWind` (`className`).

### Task 4.1: Component Pilot - SuggestionCard
**Context:** `src/components/SuggestionCard.tsx` uses `StyleSheet`.
**Target:** `src/components/SuggestionCard.tsx`

**Agent Prompt:**
```text
Role: UI Engineer (Tailwind Expert)
Task: Refactor SuggestionCard to NativeWind

1. Open `src/components/SuggestionCard.tsx`.
2. Identify the `StyleSheet.create` block.
3. For every style object:
   - Delete the style object.
   - Apply equivalent Tailwind classes to the `className` prop of the component.
   - Example: `container: { padding: 16 }` -> `className="p-4"`.
   - Use `src/shared/theme/tokens.ts` as a reference for colors/spacing mapping.
4. Verify: Ensure all `style={styles.x}` props are removed.
5. Constraint: Do not change the logic or component structure, only the styling method.
```

---

## Execution Protocol
1.  Select a Task.
2.  Copy the **Agent Prompt**.
3.  Execute.
4.  Run type checkers (`tsc --noEmit`).
5.  If successful, mark as **[Done]** in `task.md`.
