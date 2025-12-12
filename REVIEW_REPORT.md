# Code Review & Architecture Analysis

## 🚨 Critical Bugs & Issues

1.  **N+1 Query Performance Killer (`suggestion-provider.service.ts`)**
    -   **Issue:** The `fetchSuggestions` function fetches *all* friends, then iterates through them one by one. Inside the loop, it performs **two separate database queries** per friend (one for `interaction_friends` junction, one for `interactions` table).
    -   **Impact:** With 50 friends, this runs 101 queries instantly. This will cause significant lag on older devices and scale poorly.
    -   **Fix:** Use WatermelonDB's `unsafeSql` or specialized raw queries to fetch the latest interaction for all friends in a single go, or denormalize `lastInteractionId` onto the Friend model.

2.  **Unused Event Bus & Circular Dependency Risks**
    -   **Issue:** The `EventBus` (`src/shared/events/event-bus.ts`) is defined but **completely unused** (0 usages). Meanwhile, there are ~59 deep imports violating module boundaries (e.g., `intelligence` importing directly from `interactions`).
    -   **Impact:** This makes the codebase fragile. Changing one module can break another unexpectedly. It causes "require cycles" which can crash React Native on startup.
    -   **Fix:** Decouple modules. Instead of `intelligence` importing `interactions`, `interactions` should emit an event (`INTERACTION_LOGGED`) that `intelligence` listens to.

3.  **Database Instance Leakage**
    -   **Issue:** `src/db/index.ts` exports the raw `database` instance. It is imported directly by UI components and services alike.
    -   **Impact:** This tightly couples the entire app to WatermelonDB. Testing is hard because you have to mock the entire DB. You cannot easily switch storage backends or add a caching layer.
    -   **Fix:** Wrap DB access in Repositories or Service classes. Only those should import `database`.

4.  **Race Conditions in `app/_layout.tsx`**
    -   **Issue:** The `useEffect` that sets `uiMounted` runs a check for `database.get('friends')`. If this promise resolves *after* the component unmounts (rare but possible), it attempts to set state on an unmounted component.
    -   **Impact:** Potential memory leaks or yellow-box warnings.
    -   **Fix:** The existing `isMounted` ref pattern is correct, but the logic is convoluted. It should be simplified using a custom hook `useDatabaseReady()`.

5.  **Type Safety Gaps (164+ Issues)**
    -   **Issue:** Heavy use of `any` in Database Models (e.g., `Friend.ts`, `Interaction.ts`) and Migration scripts.
    -   **Impact:** TypeScript cannot catch simple typos or property access errors, leading to runtime undefined crashes.
    -   **Fix:** Define strict Interfaces for all DB models and remove `any`.

---

## 🏗️ Top 10 Recommended Improvements

### Architecture & Pattern Improvements

1.  **Implement the Event Bus Pattern (Immediately)**
    -   **Why:** To break the circular dependency chain between `intelligence`, `interactions`, and `gamification`.
    -   **How:** In `_layout.tsx`, initialize `EventBus`. When an interaction is logged, emit `interaction:created`. `intelligence` subscribes to this to run scoring. `gamification` subscribes to run badges.

2.  **Consolidate Data Access into Repositories**
    -   **Why:** To stop importing `database` everywhere and fix the N+1 query issue centrally.
    -   **How:** Create `src/modules/relationships/repositories/friend.repository.ts`. It should have methods like `getAllFriendsWithLastInteraction()`.

3.  **Refactor `app/_layout.tsx` (The "God Component")**
    -   **Why:** It currently handles initialization, providers, modals, analytics, sync, and navigation. It's too big (400+ lines).
    -   **How:** Extract logic into wrappers: `<AppProvider>`, `<DataInitializer>`, `<NotificationManager>`. Keep `_layout.tsx` purely for Navigation structure.

4.  **Strict Module Boundaries (ESLint Rule)**
    -   **Why:** 59 violations found. Developers are importing "private" service files from other modules.
    -   **How:** Enforce `no-restricted-imports` in ESLint. Only allow imports from `@/modules/*/index`. All cross-module access must go through the public API or Event Bus.

### Code Quality & Performance

5.  **Fix "Temporary" Logic in `orchestrator.service.ts`**
    -   **Why:** The code explicitly says `// This is a temporary function`.
    -   **How:** Finish the refactor. Move the logic into `scoring.service.ts` properly and remove the adapter code.

6.  **Optimize `fetchSuggestions` with Raw SQL**
    -   **Why:** It's the slowest part of the app start.
    -   **How:** Replace the loop with a single WatermelonDB `unsafeExecuteSql` query that joins Friends and Interactions to get the latest dates in one fetch.

7.  **Standardize React Query Usage**
    -   **Why:** The app mixes WatermelonDB `withObservables` (HOC) and `useQuery` (Hook).
    -   **How:** Commit to **Hooks**. Use `useQuery` for reading data. It's easier to compose than HOCs and works better with modern React.

8.  **Centralize Configuration**
    -   **Why:** Constants like `POSTHOG_API_KEY` and specific thresholds are scattered in service files.
    -   **How:** Create `src/config/app.config.ts`. Put all magic numbers, API keys, and feature flags there.

9.  **Automate "Deep Import" Detection in CI**
    -   **Why:** To prevent regression.
    -   **How:** Add the Python script I used (or a simple shell script) to the `pre-commit` hooks or CI pipeline.

10. **Sanitize Database Models**
    -   **Why:** Models currently contain some business logic getters (e.g., `tier` casting).
    -   **How:** Models should be dumb schemas. Move *all* derived logic (like "is this friend dormant?") to `FriendService` or `FriendEntity` domain objects.

---

## 📊 Analysis Summary

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Architecture** | ⚠️ At Risk | Circular dependencies are a major fragility risk. |
| **Performance** | ⚠️ At Risk | N+1 query in suggestions will scale poorly. |
| **Type Safety** | ⚠️ At Risk | Too many `any` types in core DB models. |
| **Code Style** | ✅ Good | Consistent use of standard formatting. |
| **Tech Stack** | ✅ Strong | WatermelonDB + Expo is a solid choice. |
