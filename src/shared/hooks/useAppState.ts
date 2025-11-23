import { useEffect, useState, useCallback } from 'react';
import { AppStateStatus } from 'react-native';
import { appStateManager } from '@/shared/services/app-state-manager.service';

/**
 * Hook to track app state (active, background, inactive)
 */
export function useAppState() {
  const [appState, setAppState] = useState<AppStateStatus>(appStateManager.getState());

  useEffect(() => {
    const unsubscribe = appStateManager.subscribe(setAppState);
    return unsubscribe;
  }, []);

  return appState;
}

/**
 * Hook to track if app is idle
 */
export function useAppIdle() {
  const [isIdle, setIsIdle] = useState(appStateManager.isIdle());

  useEffect(() => {
    const unsubscribe = appStateManager.subscribeToIdle(setIsIdle);
    return unsubscribe;
  }, []);

  return isIdle;
}

/**
 * Hook to check if app should be sleeping (background or idle)
 */
export function useAppSleeping() {
  const appState = useAppState();
  const isIdle = useAppIdle();

  return appState !== 'active' || isIdle;
}

/**
 * Hook that provides a function to record user activity
 * Call this on user interactions to reset idle timer
 */
export function useRecordActivity() {
  return useCallback(() => {
    appStateManager.recordActivity();
  }, []);
}

/**
 * Hook that runs a callback when app state changes
 */
export function useAppStateChange(callback: (state: AppStateStatus) => void) {
  useEffect(() => {
    const unsubscribe = appStateManager.subscribe(callback);
    return unsubscribe;
  }, [callback]);
}

/**
 * Hook that pauses/resumes an effect when app sleeps
 */
export function usePausableEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  pauseWhenSleeping = true
) {
  const isSleeping = useAppSleeping();

  useEffect(() => {
    if (pauseWhenSleeping && isSleeping) {
      // Don't run effect when sleeping
      return;
    }

    return effect();

  }, [isSleeping, ...deps]);
}
