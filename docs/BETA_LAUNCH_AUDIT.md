# Beta Launch Audit - TestFlight Readiness

## Executive Summary

The Weave application has made significant progress in its architectural refactor, successfully establishing a modular structure (`src/modules`) and normalizing the database schema. The core "Weave Engine" logic has been successfully migrated to domain-specific services in `src/modules/intelligence`.

However, the application is **not yet fully production-ready** for a reliable beta test. Critical issues in the codebase, particularly the "fat" `FriendProfile` component and missing persistence in the `SyncEngine`, pose significant risks to user experience and data integrity. Additionally, widespread use of `console.log` in production logic will degrade performance.

We recommend addressing the **Critical Issues** listed below immediately. The **Code Quality** and **Feature Readiness** sections provide a detailed breakdown of the current state, and the **Recommendations** section offers a roadmap for pre-launch improvements.

---

## Critical Issues (Must Fix Before Beta)

### 1. Data Persistence & Sync
*   **Issue:** The `SyncEngine` (`src/modules/auth/services/sync-engine.ts`) has `TODO` comments for `loadLastSyncTimestamp` and `saveLastSyncTimestamp`.
*   **Impact:** Without these, the app will attempt to sync *all* data from the beginning of time on every sync attempt, or miss changes. This will lead to massive data usage, slow performance, and potential data loss or duplication.
*   **Fix:** Implement `AsyncStorage` calls to save and retrieve the last sync timestamp.

### 2. Performance & Logging
*   **Issue:** Widespread usage of `console.log` in critical service paths (e.g., `orchestrator.service.ts`, `event-notifications.ts`).
*   **Impact:** Console logging in React Native is synchronous and slow. Leaving these in production builds will cause frame drops and battery drain.
*   **Fix:** Replace all `console.log` with a proper logger (like the existing Sentry integration or a custom wrapper that no-ops in production) or remove them.

### 3. "Fat" FriendProfile Component
*   **Issue:** `app/friend-profile.tsx` is monolithic (over 600 lines) and mixes complex UI rendering, state management, and **direct database model imports**.
*   **Impact:** This component is fragile and hard to debug. Direct model usage bypasses the service layer, breaking the "Pure Service" architecture and potentially causing UI freezes if heavy DB operations run on the JS thread.
*   **Fix:**
    *   Extract sub-components (e.g., `ProfileHeader`, `TimelineList`, `ActionButtons`).
    *   Move remaining logic to `useFriendProfileData` or a new `FriendProfileViewModel`.
    *   Ensure **all** data access goes through services/DTOs, not models.

---

## Code Quality Audit

### Architecture
*   **Status:** ✅ **Good**
*   **Details:** The `src/modules` structure is well-established. `src/lib` has been deleted (though some docs are stale). Shared utilities are correctly placed in `src/shared`.
*   **Violation:** `app/friend-profile.tsx` imports `@/db/models/LifeEvent` and `Intention` directly. This violates the architectural rule that UI should only consume DTOs from services.

### Database
*   **Status:** ✅ **Excellent**
*   **Details:** The WatermelonDB schema (v36) is robust, normalized, and supports advanced features like "Tier Intelligence" and "Reciprocity Tracking".

### Configuration
*   **Status:** ⚠️ **Mixed**
*   **Details:**
    *   `react-native-get-random-values` is correctly polyfilled.
    *   Sentry and PostHog are initialized.
    *   **Risk:** `data-export.ts` has a hardcoded version string (`'1.0.0'`). This should be pulled from `Application.nativeApplicationVersion`.

---

## Feature Readiness Report

| Feature Module | Status | Notes |
| :--- | :--- | :--- |
| **Auth & Sync** | ⚠️ **Risk** | Sync engine is missing timestamp persistence (see Critical Issues). |
| **Intelligence** | ✅ **Ready** | "Weave Engine" logic (scoring, decay, momentum) is fully migrated to pure services. |
| **Interactions** | ⚠️ **Partial** | `suggestion-tracker.service.ts` has a `FIXME` regarding multiple friends/group interactions. Group plans might be buggy. |
| **Relationships** | ✅ **Ready** | Core CRUD and lifecycle logic is solid. `Friend` model is rich. |
| **Gamification** | ✅ **Ready** | Badges, streaks, and achievements are implemented. |
| **Reflection** | ✅ **Ready** | Oracle, weekly reviews, and "story chips" are supported. |
| **Notifications** | ✅ **Ready** | Event suggestions and battery check-ins are implemented. |

---

## Bugs & Known Issues

1.  **Group Interaction Tracking:** The `suggestion-tracker` does not yet handle multiple friends correctly (`FIXME`).
2.  **Hardcoded Version:** Data exports will always say "1.0.0".
3.  **UI Performance:** `friend-profile.tsx` relies on `runOnJS` for scroll handlers, which is good, but the heavy render method might still cause jank on older devices.
4.  **Stale Documentation:** `docs/` references `src/lib`, which might confuse new contributors during the beta phase if hotfixes are needed.

---

## Recommendations for Launch

1.  **Immediate Fixes (P0):**
    *   Implement `AsyncStorage` for `SyncEngine`.
    *   Run a global search and replace to strip `console.log` or wrap it in `if (__DEV__)`.

2.  **Stability Improvements (P1):**
    *   Refactor `app/friend-profile.tsx` to remove direct Model imports. This guards against database schema changes crashing the UI.
    *   Address the `FIXME` in `suggestion-tracker` if group features are part of the beta.

3.  **Cleanup (P2):**
    *   Update `docs/` to remove references to `src/lib`.
    *   Remove unused files in `patches/` if they are no longer needed.

4.  **TestFlight Specifics:**
    *   Verify that `app.json` has the correct `bundleIdentifier` and `version` for TestFlight.
    *   Ensure `sentry-expo` upload scripts are running during build to get symbolicated crash reports.
