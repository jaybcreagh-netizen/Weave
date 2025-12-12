# Refactor Plan: `app/_layout.tsx` Decomposition

**Context:** The `app/_layout.tsx` file has become a "God Component," handling providers, initialization, global modals, and navigation. This refactor aims to separate these concerns.

## Goals
1.  **Reduce Complexity:** Shrink `_layout.tsx` from ~550 lines to <100 lines.
2.  **Improve Readability:** Make the root of the app declarative and easy to understand.
3.  **Encapsulate Concerns:** Move logic into dedicated components (`AppProviders`, `DataInitializer`, `GlobalModals`).

## Phase 1: Create `AppProviders` Wrapper
**Goal:** Consolidate all Context Providers into a single wrapper.

-   **Target:** `src/components/AppProviders.tsx`
-   **Input:** `QueryClientProvider`, `PostHogProvider`, `PortalProvider`, `CardGestureProvider`, `QuickWeaveProvider`, `ToastProvider`, `GestureHandlerRootView`.
-   **Note:** `GestureHandlerRootView` needs `flex: 1` and background color from theme. It might be better to keep `GestureHandlerRootView` near the top or inside the provider if it's purely structural. `PostHogProvider` and `QueryClientProvider` are currently in `RootLayout`, while others are in `RootLayoutContent`. We can merge these layers.

## Phase 2: Create `GlobalModals` Component
**Goal:** Move all global modals and sheets out of the layout.

-   **Target:** `src/components/GlobalModals.tsx`
-   **Logic:**
    -   Import `useUIStore` and other stores needed for modal visibility.
    -   Render:
        -   `MilestoneCelebration`
        -   `TrophyCabinetModal`
        -   `NotificationPermissionModal`
        -   `EventSuggestionModal`
        -   `WeeklyReflectionModal`
        -   `SyncConflictModal`
        -   `PostWeaveRatingModal`
        -   `MemoryMomentModal`
        -   `DigestSheet`
-   **Benefit:** `_layout.tsx` will just render `<GlobalModals />`.

## Phase 3: Extract Initialization Logic (`DataInitializer` & `NotificationManager`)
**Goal:** Move side-effect / initialization logic out of the UI render path.

### 3.1 `DataInitializer`
-   **Target:** `src/components/DataInitializer.tsx`
-   **Logic:**
    -   Database migrations & init.
    -   User profile & progress init.
    -   Analytics init.
    -   Background sync init.
    -   App State change listeners (AutoBackup).
    -   Fonts loading (or keep in layout if it blocks rendering? Better to keep `fontsLoaded` check in layout or pass it down).
    -   Splash Screen hiding logic.
-   **Return:** Returns `null` or `children` only when initialized.

### 3.2 `NotificationManager`
-   **Target:** `src/components/NotificationManager.tsx`
-   **Logic:**
    -   `NotificationOrchestrator` init.
    -   Permission checks.
    -   Response listeners.
    -   Intelligence & Gamification listeners (setup).

## Phase 4: Final `_layout.tsx` Assembly
**Goal:** Reassemble the significantly smaller layout.

**Structure:**
```tsx
export default function RootLayout() {
  return (
    <AppProviders>
       <DataInitializer>
          <NotificationManager />
          <Stack screenOptions={{ headerShown: false }} />
          <GlobalModals />
       </DataInitializer>
    </AppProviders>
  );
}
```

## Agent Prompts for Execution

### Prompt 1: Extract Global Modals
> You are a React Native Refactoring Expert.
> **Task:** Extract all global modals from `app/_layout.tsx` into a new component `src/components/GlobalModals.tsx`.
> 1.  Create `src/components/GlobalModals.tsx`.
> 2.  Move `MilestoneCelebration`, `TrophyCabinetModal`, `WeeklyReflectionModal`, `SyncConflictModal`, `PostWeaveRatingModal`, `MemoryMomentModal`, `DigestSheet`, and `EventSuggestionModal` to this new component.
> 3.  Move the relevant `useUIStore` selectors and state logic needed for these modals to the new component.
> 4.  Update `app/_layout.tsx` to import and render `<GlobalModals />`.
> 5.  Ensure no functionality is lost (modals should still open/close as before).

### Prompt 2: Extract Providers
> You are a React Native Refactoring Expert.
> **Task:** Extract global providers into `src/components/AppProviders.tsx`.
> 1.  Create `src/components/AppProviders.tsx`.
> 2.  Move `QueryClientProvider`, `PostHogProvider`, `PortalProvider`, `CardGestureProvider`, `QuickWeaveProvider`, `ToastProvider` into this component.
> 3.  Keep `GestureHandlerRootView` as the root wrapper inside `AppProviders` (or wrapped by them) to ensure gestures work.
> 4.  Update `app/_layout.tsx` to use `<AppProviders>` wrapping the application.

### Prompt 3: Extract Initialization Logic
> You are a React Native Refactoring Expert.
> **Task:** Extract data initialization and notification logic.
> 1.  Create `src/components/DataInitializer.tsx`. Move the `initializeData`, `initializeAnalytics`, `PlanService.checkPendingPlans`, and font loading logic here. It should render a `LoadingScreen` until ready, then render `children`.
> 2.  Create `src/components/NotificationManager.tsx`. Move `NotificationOrchestrator` setup, `useNotificationPermissions`, and event listener setups (Intelligence, Gamification) here. This component should return `null` (it just handles side effects).
> 3.  Refactor `app/_layout.tsx` to use these new components.
