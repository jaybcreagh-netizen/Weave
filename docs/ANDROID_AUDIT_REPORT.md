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

### 3.1 Cloud Backup for Android
To enable "Cloud Sync" (Backup) on Android, we should not just rely on the existing Supabase sync. If the goal is a file-based JSON backup similar to iCloud:
1.  **Enable Google Drive API** in the Google Cloud Console for the project.
2.  **Update Google Sign-In** scopes in `supabase-auth.service.ts` to include `https://www.googleapis.com/auth/drive.appdata`.
3.  **Configure `react-native-cloud-storage`** to use the Google Drive adapter on Android.

### 3.2 Navigation & Hardware Back Button
Android users rely heavily on the hardware back button.
*   *Audit:* `AnimatedBottomSheet` and standard Modals should intercept the back button to close the modal instead of navigating back in the stack.
*   *Action:* Verified `AnimatedBottomSheet` does **not** currently have explicit `BackHandler` logic, though `Modal` components usually handle this natively if `onRequestClose` is provided.
    *   *Verification:* `src/shared/ui/Sheet/AnimatedBottomSheet.tsx` uses a standard `Modal` which maps the hardware back button to `onRequestClose`. **This is correct.**

## 4. Completed Actions
*   [x] Audit `src/shared/ui` for Android compatibility.
*   [x] Fix `Card.tsx` to render shadows on Android.
*   [x] Fix `MilestoneCelebration.tsx` to be immersive (translucent status bar).
*   [x] Verify Auth flow (Apple Auth properly hidden on Android).

## 5. Next Steps
1.  **Manual QA:** Verify the "Elevation" look on an actual Android device/emulator.
2.  **Decide on Backup Strategy:** If Supabase Sync is sufficient for the user's needs, the `AutoBackupService` on Android might be redundant. If a file-based backup is a strict requirement, schedule the Google Drive integration work.
