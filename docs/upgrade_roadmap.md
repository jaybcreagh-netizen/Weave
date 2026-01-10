# Upgrade Roadmap: React Native 0.81.5 (Expo SDK 54)

## Overview
This roadmap outlines the precise steps to upgrade `Weave` from Expo SDK 52 (RN 0.76) to Expo SDK 54 (RN 0.81.5).

> [!IMPORTANT]
> **Risk Assessment**: The jump from RN 0.76 to 0.81.5 is significant.
> - **Mandatory**: Android 16 targeting.
> - **Critical Risk**: `WatermelonDB` relies on a custom Expo plugin (`@lovesworking/watermelondb-expo-plugin-sdk-52-plus`). This **MUST** be addressed carefully.
> - **Strategy**: We will perform an **incremental upgrade** (SDK 52 -> SDK 53 -> SDK 54) to isolate breaking changes.

---

## Phase 1: Pre-Upgrade Preparation & Cleanup
**Goal**: Ensure a clean, stable environment before starting the upgrade.

- [ ] **1.1. Remove Stale Patches**
  - Delete `patches/@nozbe+watermelondb+0.25.5.patch` if it is no longer relevant for the new versions, or verify if it needs rebasing. given it targets v0.25.5 and we are on v0.28.0, it is likely tech debt.
  - *Command*: `rm patches/@nozbe+watermelondb+0.25.5.patch` (verify contents first).
- [ ] **1.2. Audit Deprecated Components** (Refactor **BEFORE** upgrading)
  - [x] `SafeAreaView` (Done)
  - [ ] **Verify `app.json` Plugins**: Check if `@lovesworking/watermelondb-expo-plugin-sdk-52-plus` has a new version for SDK 53/54 or if we can revert to the official `@nozbe/watermelondb/app.plugin`.
- [ ] **1.3 Environment Check**
  - Ensure Node.js >= 20 (`node -v`)
  - Ensure Xcode >= 16.1 (for iOS 18 SDK support)
  - Ensure Java 17/21 is available for Android builds.

---

## Phase 2: Intermediate Upgrade (Expo SDK 53 / RN 0.77)
**Goal**: Bridge the gap to reduce the blast radius of breaking changes.

- [ ] **2.1. Update Expo to SDK 53**
  ```bash
  npx expo install expo@^51.0.0
  # Wait, SDK 53 is the target intermediate.
  npx expo install expo@51 # NOTE: Double check version mapping. SDK 52 is RN 0.76. SDK 53 (beta/release) targets RN 0.77. 
  # If SDK 53 is not fully stable/released as a distinct stopping point, check Expo docs. 
  # ASSUMPTION: SDK 53 exists or we upgrade RN incrementally. 
  # Standard Expo flow:
  npx expo install expo@52 # We are here.
  # If SDK 53 is skipped by Expo (sometimes they do), go to next stable.
  # Let's assume we use the standard "upgrade one major version" rule of thumb if possible.
  ```
  *Correction*: If current is SDK 52, `npx expo install expo@53` (if available) or `expo@latest` if 54 is the only next step. 
  *Action*: Check `npm view expo versions` to see if 53 exists. If yes:
  ```bash
  npx expo install expo@53
  npx expo install --fix
  ```
- [ ] **2.2. Verify WatermelonDB (SDK 53 context)**
  - Rebuild prebuilds: `npx expo prebuild --clean`
  - Run iOS/Android: `npx expo run:ios` / `npx expo run:android`
  - *Fail Condition*: If the custom plugin fails, attempt to switch to `@nozbe/watermelondb` official plugin or search for a `sdk-53` fork.

---

## Phase 3: The Major Upgrade (Expo SDK 54 / RN 0.81)
**Goal**: Target Release.

- [ ] **3.1. Install SDK 54**
  ```bash
  npx expo install expo@54
  npx expo install --fix
  ```
- [ ] **3.2. Kotlin Version Bump**
  - In `app.json`, update `expo-build-properties`:
    ```json
    "android": {
      "kotlinVersion": "2.0.20" // Check RN 0.81 recommendation (likely 1.9.24+ or 2.x)
    }
    ```
- [ ] **3.3. React Native Reanimated & Gesture Handler**
  - These are highly sensitive to RN versions. Ensure `npx expo install --fix` grabbed the correct compatible versions.
  - *Check*: `package.json` should have `react-native-reanimated` ~3.16.x or newer (v4 might be required for RN 0.81 depending on release timing).

---

## Phase 4: Critical Dependency Resolution (WatermelonDB)
**Goal**: Fix the database layer, which is the most likely failure point.

> [!WARNING]
> The custom plugin `@lovesworking/watermelondb-expo-plugin-sdk-52-plus` was a workaround. It implies the official plugin was broken for SDK 52.

- [ ] **4.1. Attempt Official Plugin**
  - Modify `app.json`:
    ```diff
    - "@lovesworking/watermelondb-expo-plugin-sdk-52-plus",
    + ["@nozbe/watermelondb/plugin", {}] // Check exact import path in docs
    ```
  - Run `npx expo prebuild --clean`.
  - Compile.
- [ ] **4.2. fallback: Search for Fork**
  - If official plugin fails (likely due to JSI/Native module link changes in RN 0.81), look for `@lovesworking...sdk-54` or similar community forks.
- [ ] **4.3. Manual Patching**
  - If no plugin works, we may need to manually `patch-package` the `node_modules/@nozbe/watermelondb` native compilation files (Android/iOS folders) to support RN 0.81 headers.

---

## Phase 5: New Architecture (Fabric/TurboModules)
**Goal**: Decide on future-proofing.

- [ ] **5.1. Enable New Architecture?**
  - RN 0.81 heavily pushes for this. 
  - WatermelonDB *does* support JSI, but strict New Arch support might be experimental.
  - *Recommendation*: **Keep disabled** (`"newArchEnabled": false` in `app.json`) for the initial upgrade to reduce variables. Enable only after stable on SDK 54.

---

## Phase 6: Verification & regression Testing

- [ ] **6.1. Clean Build**
  - `git clean -dfx` (Careful! Removes all ignored files including local envs - backup `.env`!)
  - `npm install`
  - `npx expo prebuild`
  - `npx expo run:ios` 
- [ ] **6.2. Visual Regression**
  - Check `FriendSelector.tsx` (FlashList + Reanimated interaction).
  - Check `OracleModeSheet.tsx` (BlurView + BottomSheet interaction).
- [ ] **6.3. Database Smoke Test**
  - Create a new Weave.
  - Verify persistence after app restart (checks WatermelonDB JSI link).

## Rollback Plan
If blocked at Phase 3 or 4:
1. `git checkout main`
2. `rm -rf node_modules ios android`
3. `npm install`
4. `npx expo prebuild`
