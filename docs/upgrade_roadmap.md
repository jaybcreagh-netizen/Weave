# Upgrade Roadmap: React Native 0.81.5 (Expo SDK 54)

## Overview
This roadmap outlines the steps to upgrade `Weave` from Expo SDK 52 (RN 0.76) to Expo SDK 54 (RN 0.81.5).

> [!IMPORTANT]
> The jump from RN 0.76 to 0.81.5 is significant. This upgrade introduces **mandatory** Android 16 targeting and removes several legacy APIs.

## Phase 1: Preparation (Before Upgrade)
- [ ] **Audit Deprecated Components**: Replace all instances of `SafeAreaView` imported from `react-native` with `SafeAreaView` from `react-native-safe-area-context`.
  - **Status**: Audit Complete.
  - **Action Needed**: Refactor the following files:
    - [ ] `src/modules/relationships/components/FriendSelector.tsx`
    - [ ] `src/modules/oracle/components/OracleModeSheet.tsx`
    - [ ] `src/modules/oracle/components/OracleSheet.tsx`
  - **Verification**: Run `grep -r "SafeAreaView" src` and ensure no results import from `'react-native'`.
- [ ] **Verify Other Deprecations**:
  - `AsyncStorage`: ✅ Correctly using `@react-native-async-storage/async-storage`.
  - `Slider`: ✅ Correctly using `@react-native-community/slider`.
  - `ViewPropTypes`: ✅ No usage found.
- [ ] **Lock Env Versions**: Ensure development machines have Node 20+ and Xcode 16.1+ installed.

## Phase 2: The Upgrade (Expo SDK 54)
- [ ] **Run Upgrade Command**:
    ```bash
    npx expo install expo@latest
    npx expo install --fix
    ```
- [ ] **Verify Dependencies**: Manually check `package.json` to ensure `react-native-reanimated` and `react-native-gesture-handler` align with Expo SDK 54 requirements.

## Phase 3: Breaking Changes Resolution
### 1. Android 16 Edge-to-Edge
- [ ] **StatusBar**: Verify `StatusBar` (from `expo-status-bar`) behavior. RN 0.81 forces edge-to-edge on Android 16.
- [ ] **Paddings**: Check screens that might rely on implicit system UI insets. Ensure `useSafeAreaInsets()` is used for sourcing padding.

### 2. iOS Precompiled Builds
- [ ] **Podfile**: If using custom native modules, ensure they are compatible with precompiled frameworks (rarely an issue for standard Expo modules).

### 3. API Removals
- [ ] **ViewPropTypes**: If any third-party libraries crash with `ViewPropTypes is not defined`, patch them using `patch-package` or upgrade the library.
- [ ] **Legacy Components**: Ensure no usage of `DatePickerIOS` or `DatePickerAndroid` (use `@react-native-community/datetimepicker`).

## Phase 4: Verification
- [ ] **Build Check**: Run `npx expo run:ios` and `npx expo run:android` (clean builds).
- [ ] **Visual Regression**: Check "Relationship Profile" and "Friend Selector" screens for layout shifts due to SafeArea changes.
- [ ] **Gestures**: Verify `BottomSheet` interactions, as reanimated/gesture-handler upgrades often affect these.

## Rollback Plan
If critical issues arise, revert `package.json` and `yarn.lock`/`package-lock.json` to the previous commit.
