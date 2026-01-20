# Android Audit Report & Implementation Plan

## 1. Executive Summary
This audit focuses on identifying and resolving platform discrepancies between iOS and Android for the Weave application. The primary goal is to ensure a "native-feeling" experience on Android, addressing UI consistency, animation fluidity, and feature parity in cloud services.

## 2. Key Findings & Fixes

### 2.1 UI/UX Anomalies
| Component | Issue | Status | Resolution |
|-----------|-------|--------|------------|
| **Cards** | Flat appearance; missing depth on Android. | ✅ Fixed | Added `elevation: 3` to the default `Card` variant in `src/shared/ui/Card.tsx` to match iOS shadows. |
| **Modals** | Status bar not translucent, creating a jarred experience. | ✅ Fixed | Added `statusBarTranslucent` prop to `MilestoneCelebration` modal. `AnimatedBottomSheet` already supported this. |
| **Shadows** | iOS relies on `shadow*` props, which are ignored on Android. | ✅ Fixed | Unified shadow logic in `Card` component to use `elevation` API on Android. |
| **Ripples** | Android users expect ripple feedback on touchables. | ⚠️ Pending | NativeWind/Tailwind buttons use opacity changes. Recommendation: Adopt `android_ripple` for `Pressable` components in a future UI polish sprint. |

### 2.2 Animation & Performance
*   **Reanimated:** The project uses `react-native-reanimated` effectively. No major performance bottlenecks were observed in the reviewed code.
*   **Blur Views:** The `BlurView` component from `expo-blur` is used in `AnimatedBottomSheet`.
    *   *Note:* Android blur performance can be expensive on lower-end devices. The current implementation correctly uses a fallback transparent background if blur is not supported or if performance issues arise (controlled via `isDarkMode` and intensity settings).

### 2.3 Auth & Cloud Sync Strategy
The application currently employs a dual strategy for data safety:
1.  **Live Sync (Supabase):** Handled by `DataReplicationService`. This works cross-platform (iOS & Android) and is the primary method for multi-device sync.
2.  **Backup (Cloud Storage):** Handled by `AutoBackupService`.
    *   *Current State:* iOS uses **iCloud** (via `react-native-cloud-storage`).
    *   *Android Gap:* The current implementation explicitly disables backup on Android (`if (Platform.OS === 'android') return false;`).
    - [x] **Auth Screen Improvements**:
  - [x] **Issue**: Apple Sign-In button was visible on Android. Google button wasn't unified.
  - [x] **Action**: Refactored `OnboardingAuthScreen` to strict platform checks. Replaced custom Google button with standardized Weave `Button` + `GoogleIcon` (SVG).
  - [x] **Consolidation**: Removed legacy `AuthScreen.tsx`. `OnboardingAuthScreen` is now the universal auth UI.
    *   *Recommendation:* To achieve parity, **Google Drive** integration is required. The `react-native-cloud-storage` library supports Google Drive but requires additional configuration (Google Sign-In scopes + Drive API setup).

**Code Reference:**
```typescript
// src/modules/backup/AutoBackupService.ts
init: async (): Promise<boolean> => {
    // Cloud backup is currently iOS-only (iCloud)
    if (Platform.OS === 'android') {
        return false;
    }
    // ...
}
```

## 3. Detailed Recommendations

###- [x] **Cloud Backup Parity**:
  - [x] **Decision**: Deprioritized Google Drive.
  - [x] **Solution**: Full Supabase Sync (Bidirectional) now covers 100% of user data (including analytics, memory, and settings). This replaces the need for manual file backups on Android.
  - [x] **Action**: Expanded `DataReplicationService` to sync all 30+ tables.

### 3.2 Navigation & Hardware Back Button
Android users rely heavily on the hardware back button.
*   *Audit:* `StandardBottomSheet` implements explicit `BackHandler` logic.
*   *Action:* Verified `src/shared/ui/Sheet/StandardBottomSheet.tsx` correctly listens for the hardware back press to dismiss the sheet.
    *   *Verification:* **CONFIRMED** - Code uses `BackHandler.addEventListener`.
    - [x] **Back Button Support**:
  - [x] **Issue**: Sheets must close on back press.
  - [x] **Verification**: Confirmed `StandardBottomSheet` has explicit `BackHandler` listeners.


## 4. Completed Actions
*   [x] Audit `src/shared/ui` for Android compatibility.
*   [x] Fix `Card.tsx` to render shadows on Android.
*   [x] Fix `MilestoneCelebration.tsx` to be immersive (translucent status bar).
*   [x] Verify Auth flow (Apple Auth properly hidden on Android).

## 5. Next Steps
1.  **Manual QA:** Verify the "Elevation" look on an actual Android device/emulator.
2.  **Decide on Backup Strategy:** If Supabase Sync is sufficient for the user's needs, the `AutoBackupService` on Android might be redundant. If a file-based backup is a strict requirement, schedule the Google Drive integration work.
