# Codebase Audit Report

## 1. Duplicate Functional Components

### UI Components
There is significant fragmentation in base UI components. While a shared UI library exists in `src/shared/ui`, many modules implement their own versions of common elements.

*   **Buttons**:
    *   **Standard**: `src/shared/ui/Button.tsx`
    *   **Custom/Duplicate Implementations**:
        *   `src/modules/relationships/components/profile/ActionButtons.tsx`
        *   `src/modules/relationships/components/IntentionsFAB.tsx`
        *   `src/modules/gamification/components/MilestoneCelebration.tsx` (Internal button logic)
        *   `src/modules/auth/components/UpgradeModal.tsx` (Custom styling overrides)

*   **Cards**:
    *   **Standard**: `src/shared/ui/Card.tsx`
    *   **Custom/Duplicate Implementations**:
        *   `src/modules/intelligence/components/archetypes/ArchetypeCard.tsx`
        *   `src/modules/gamification/components/AchievementCard.tsx`
        *   `src/modules/insights/components/TierFitCard.tsx`
        *   `src/modules/interactions/components/SuggestionCard.tsx`

**Recommendation**: Refactor these module-specific components to consume the base components from `src/shared/ui`, using props for variants rather than re-implementing structure.

### Logic & Services
*   **Scoring & Analytics**:
    *   `src/modules/intelligence/services/orchestrator.service.ts` and `src/modules/interactions/services/suggestion-engine` both contain logic for prioritizing friends/interactions. There is a risk of divergent scoring logic where "Suggesting a friend" uses different math than "Evaluating a friend's health".

## 2. Architectural Issues

### Module Coupling (Violation of Modular Spec)
The architecture spec likely forbids peer modules from deeply importing into each other, yet this is prevalent:
*   **Intelligence Module**: Heavily depends on `interactions` and `insights`.
    *   Imports `WeaveLoggingService` from `@/modules/interactions`.
    *   Imports `InteractionFormData` from `@/modules/interactions/types`.
    *   Imports `getLearnedEffectiveness` from `@/modules/insights`.
    *   Imports `analyzeAndTagLifeEvents` from `@/modules/relationships`.
*   **Risk**: This creates a circular dependency graph that makes isolation testing impossible and makes the codebase fragile to refactoring.

### State Management Strategy
The application uses a hybrid approach, creating confusion on where state lives:
*   **React Context** (Legacy/Global): `AuthContext`, `SyncConflictContext`, `CardGestureContext`.
*   **Zustand** (Newer/Modular): `sync.store.ts`, `auth.store.ts`, `quick-weave.store.ts`, `uiStore.ts`.
*   **Issue**: `AuthContext` and `auth.store.ts` coexist. Logic often has to bridge these two worlds.

### Styling Consistency
The project is migrating to **NativeWind** (`className`), but **StyleSheet.create** remains in active use in key new features, creating a "split brain" styling system.
*   **Files using legacy StyleSheet**:
    *   `src/modules/relationships/screens/FriendsDashboardScreen.tsx`
    *   `src/modules/relationships/components/FriendForm.tsx`
    *   `src/modules/onboarding/screens/OnboardingScreen.tsx`
    *   `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`
*   **Recommendation**: Convert these remaining files to NativeWind to unify the design system.

## 3. Code Health & Type Safety

### Excessive use of `any`
TypeScript safety is compromised in critical areas, particularly in database interactions and complex algorithms.
*   **Intelligence Service**: `src/modules/intelligence/services/orchestrator.service.ts` uses `any[]` for batch operations (`batchOps`), bypassing validation for database writes.
*   **Database Models**:
    *   `src/db/models/CustomChip.ts`: `components` getter/setter uses `any`.
    *   `src/db/models/Group.ts`: `associations` defined as `any`.
    *   `src/db/models/UserProgress.ts`: Comments indicate missing strict typing.
*   **Tests**: `src/modules/intelligence/__tests__/scoring.service.test.ts` relies heavily on `as any` casting, suggesting the mocks don't match the real interfaces.

### Todos & Unfinished Work
*   `src/modules/auth/components/UpgradeModal.tsx`: `// TODO: Integrate with Stripe/RevenueCat` - Critical for monetization.
*   `src/modules/journal/services/journal-prompts.ts`: `// TODO: Implement LLM call` - Core AI feature missing.
*   `src/modules/interactions/services/plan.service.ts`: `// TODO: Trigger UI celebration from the hook/store` - Missing user feedback loop.
*   `src/modules/interactions/services/weave-logging.service.ts`: `// TODO: These should be moved to the insights module` - Technical debt explicitly noted in comments.

## 4. Performance Improvements

### N+1 Query Risks
*   **Suggestion Candidate Service** (`src/modules/interactions/services/suggestion-system/SuggestionCandidateService.ts`):
    *   The service performs a query to get `potentialDrifters`, then iterates through them.
    *   It then runs a **loop** for `recentInteractionFriends`: `for (const link of recentInteractionFriends)`. While this specific loop is in-memory, the setup involves multiple detached queries that could be consolidated into a single raw SQL query or optimized WatermelonDB query.
*   **Orchestrator Service**: The use of loops to process `validInteractions` and then individually creating database entries (even if batched later) often leads to main-thread blocking if the dataset grows.

### "Fat" Components (Performance & Maintenance)
Several components in `app/` and `modules/` carry too much logic, causing re-renders and making them hard to test.
*   `src/modules/intelligence/components/social-season/YearInMoons/GraphsTabContent.tsx`: Heavily coupled to multiple hooks (`usePortfolio`, `useYearMoonData`).
*   `app/friend-profile.tsx`: Known to be a "god component" managing too many disparate pieces of friend state.

## 5. Bug Fixes & Broken Code (Potential)

*   **Circular Dependencies**: The cross-module imports mentioned in Section 2 are likely causing "undefined" errors during initialization if import order isn't perfectly managed by the bundler.
*   **Hardcoded Thresholds**: `SuggestionCandidateService` has hardcoded numbers (e.g., `50` candidates, `DRIFT_LIMIT = 20`) scattered inside the function body. These should be moved to a configuration file or constants to prevent behavior drift.
*   **Test Suitability**: The reliance on `any` in tests means that if the underlying interface changes (e.g., adding a required field to DB), the tests will still pass but the app will crash at runtime.

## Summary of Recommendations
1.  **Strictly enforce module boundaries**: Create a shared `types` or `api` layer if modules need to share data, rather than importing directly from each other's services.
2.  **Consolidate UI**: Move all "Button" and "Card" variations into `src/shared/ui` and deprecate the local versions.
3.  **Eliminate `any`**: focused sprint to type the `orchestrator` and `db/models` correctly.
4.  **Unify State**: Deprecate `AuthContext` in favor of `auth.store.ts` (Zustand) to remove the context bridge overhead.
