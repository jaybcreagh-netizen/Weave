# WeaveNative Refactoring Roadmap

**Status:** Draft / Planning  
**Date:** December 16, 2025  
**Objective:** Eliminate technical debt, enforce architectural boundaries, and standardize state/UI patterns.

---

## 🏗️ Phase 1: State Management (Kill Zustand)

**Goal:** Remove `zustand` as a dependency. Move all state to **WatermelonDB** (persistent) or **React Query** (async/derived). Use local component state for ephemeral UI toggles.

### 🎯 Strategy
The "Split Brain" problem must be solved. Zustand stores currently duplicate WatermelonDB data, creating race conditions. 
*   **Persistence:** Use `withObservables` or `useQuery` directly in components.
*   **Global Layout State:** Use `Context` or specific React Query keys for things like "Is Tutorial Open?".

### 📋 Audit: Affected Files (7 Stores)
| Store File | Refactor Strategy |
| :--- | :--- |
| `src/modules/interactions/store/interaction.store.ts` | **CRITICAL.** Delete `interactions` array. Components must observe `database.collections.get('interactions')`. Form state -> Local Component State. |
| `src/modules/auth/store/auth.store.ts` | Move user session to `AuthContext` or WatermelonDB `User` model. |
| `src/modules/auth/store/sync.store.ts` | Convert to `useSyncStatus` hook using React Query or Observable. |
| `src/modules/auth/store/sync-conflict.store.ts` | Ephemeral state. Move to `SyncConflictContext` or local state in Modal. |
| `src/modules/auth/store/user-profile.store.ts` | Merge into `User` model in DB. |
| `src/shared/stores/uiStore.ts` | Move global UI flags (modals, toasts) to `GlobalUIContext`. |
| `src/shared/stores/tutorialStore.ts` | Move tracking to `User` model (persisted) + Context. |

### 🤖 AI Agent Prompt (Phase 1)
Use this prompt to execute the migration for a single store.

> **Task:** Refactor `{TARGET_STORE_FILE}` to remove Zustand.
> 
> **Context:**
> We are migrating away from Zustand. This store likely duplicates WatermelonDB data or holds global UI state.
> 
> **Instructions:**
> 1.  **Analyze**: Read the file. Identify what state is persisted (DB data) vs. ephemeral (UI flags).
> 2.  **Plan**:
>     *   If it duplicates DB data -> Remove the store usage. Replace consumers with `withObservables` or `database.get(...).observe()`.
>     *   If it is UI state -> Create a React Context or Custom Hook `use{Feature}State`.
> 3.  **Refactor**:
>     *   Modify consumers (components using the store) first.
>     *   Delete the Zustand store file.
> 4.  **Verify**:
>     *   Run `tsc --noEmit` to ensure no broken imports.
>     *   Verify the feature still works (e.g., Modals open, Data loads).

---

## 🎨 Phase 2: UI Standardization (Kill StyleSheet)

**Goal:** Migrate 100% of components to **NativeWind** (Tailwind CSS).
**Rule:** No `StyleSheet.create` allowed in new or refactored files.

### 📋 Audit: Affected Files (68 Files)
These files use legacy `StyleSheet.create`. They must be converted to use `className="..."`.

#### **Priority 1: Shared UI & Core Components**
*   `src/shared/ui/Input.tsx`
*   `src/shared/ui/ListItem.tsx`
*   `src/shared/ui/ModernSwitch.tsx`
*   `src/shared/ui/ProgressBar.tsx`
*   `src/shared/ui/Sheet/AnimatedBottomSheet.tsx`
*   `src/shared/ui/Sheet/StandardBottomSheet.tsx`
*   `src/shared/ui/Stat.tsx`
*   `src/shared/ui/WidgetHeader.tsx`
*   `src/shared/components/CalendarView.tsx`
*   `src/shared/components/ErrorBoundary.tsx`
*   `src/shared/components/LoadingScreen.tsx`
*   `src/shared/components/MonthDayPicker.tsx`
*   `src/shared/components/SimpleTutorialTooltip.tsx`
*   `src/shared/components/TutorialOverlay.tsx`
*   `src/shared/components/fab.tsx`
*   `src/shared/components/onboarding/ArchetypeImpactDemo.tsx`
*   `src/shared/components/toast_notification.tsx`

#### **Priority 2: Feature Components**
*   **Home:** `FocusDetailSheet.tsx`, `DigestSheet.tsx`, `HomeWidgetBase.tsx`, `HomeWidgetGrid.tsx`, `ReflectionReadyWidget.tsx`, `SocialSeasonWidgetV2.tsx`, `TodaysFocusWidgetV2.tsx`, `FocusPlanItem.tsx`
*   **Insights:** `InsightsSheet.tsx`, `MetricCard.tsx`, `TierFitCard.tsx`, `PeriodToggle.tsx`, `SimpleBarChart.tsx`, `ActivityDots.tsx`, `TierProgressRow.tsx`, `TierSuggestionAlert.tsx`, `TrendBadge.tsx`, `InsightText.tsx`, `InsightsFAB.tsx`, `TierFitBottomSheet.tsx`, `GraphsTabContentV2.tsx`
*   **Interactions:** `InteractionDetailModal.tsx`, `PostWeaveRatingModal.tsx`
*   **Intelligence:** `ArchetypeCarouselPicker.tsx`, `MoonPhaseSelector.tsx`, `SocialSeasonDetailSheet.tsx`, `YearInMoons/GraphsTabContentV2.tsx`
*   **Relationships:** `ReactiveFriendProfile.tsx`, `FriendForm.tsx`, `FriendBadgePopup.tsx`, `ProfileHeader.tsx`, `FriendTierList.tsx`, `AddFriendMenu.tsx`, `FriendSearchResults.tsx`, `IntentionsDrawer.tsx`, `IntentionsFAB.tsx`, `IntentionsList.tsx`, `ReciprocitySelector.tsx`, `ContextualReflectionInput.tsx`, `LifeEventsSection.tsx`, `TimelineList.tsx`, `ActionButtons.tsx`, `TierBalanceContent.tsx`, `IntentionActionSheet.tsx`
*   **Reflection:** `ReflectionStoryChips.tsx`, `MicroReflectionSheet.tsx`, `ReflectionTextInput.tsx`
*   **Auth/Gamification:** `SyncConflictModal.tsx`, `PatternBadge.tsx`, `CelebrationAnimation.tsx`

### 🤖 AI Agent Prompt (Phase 2)
Use this prompt to refactor a batch of 5 files.

> **Task:** Refactor these 5 components to use NativeWind/Tailwind.
> 
> **Target Files**: [List 5 files here]
> 
> **Instructions:**
> 1.  **Analyze**: Open the file. Look at `StyleSheet.create`.
> 2.  **Refactor**:
>     *   Remove `import { StyleSheet } ...`.
>     *   Remove `const styles = StyleSheet.create(...)`.
>     *   Convert all `style={styles.container}` to `className="flex-1 bg-white dark:bg-slate-900 ..."` equivalents.
>     *   **Dark Mode**: Ensure you use `dark:` modifiers for colors. Refer to `src/shared/theme/tokens.ts` for guidance, but use Tailwind classes.
>     *   **Preserve Logic**: Do not change component logic, only styling.
> 3.  **Verify**:
>     *   Run `tsc --noEmit` to check for type errors.
>     *   Ensure the component structure remains identical.

---

## 🧱 Phase 3: Module Boundaries (Deep Imports)

**Goal:** Strictly enforce "Public API Only" for cross-module communication.
**Rule:** `import ... from '@/modules/A/internal/file'` is FORBIDDEN if you are in `src/modules/B`.

### 📋 Audit: Violation Types
1.  **Service Leaks:** Imports of `orchestrator.service.ts` or `scoring.service.ts` directly.
    *   *Fix:* Export these via `src/modules/intelligence/index.ts`.
2.  **Component Leaks:** Imports of specific components like `FriendBadgePopup`.
    *   *Fix:* Export via `src/modules/relationships/index.ts`.
3.  **Type Leaks:** Importing internal types.
    *   *Fix:* Move shared types to `src/shared/types` OR export via `index.ts`.
4.  **Circular Interactions:** `interactions` <-> `intelligence`.
    *   *Fix:* Use Event Bus (`src/shared/events/event-bus.ts`) for triggering scoring logic from interactions.

### 🤖 AI Agent Prompt (Phase 3)
Use this prompt to fix a specific module's imports.

> **Task:** Fix module boundary violations in `{TARGET_MODULE}`.
> 
> **Context:**
> `{TARGET_MODULE}` imports deep paths from other modules, or has its internals imported by others.
> 
> **Instructions:**
> 1.  **Analyze Imports (Outgoing)**:
>     *   Find `import ... from '@/modules/OTHER/...'`.
>     *   If the import is NOT `.../index` (or just `.../OTHER`), it is a violation.
>     *   Check if `OTHER` exports the needed member in its `index.ts`. If not, add the export there.
>     *   Update the import to `from '@/modules/OTHER'`.
> 2.  **Analyze Exports (Incoming)**:
>     *   Check who imports *from* this module deeply.
>     *   Expose necessary components/services in `{TARGET_MODULE}/index.ts`.
> 3.  **Circular Breaking (Advanced)**:
>     *   If a cycle is detected (e.g., A imports B, B imports A), introduce an Interface in `src/shared/types` or use the Event Bus pattern.
> 4.  **Verify**:
>     *   Run `tsc --noEmit`.
