import { useEffect } from 'react';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { appStateManager } from '../lib/app-state-manager';

/**
 * Custom hook that keeps the screen awake while the user is active,
 * and allows it to sleep when the app is idle.
 * It uses the global appStateManager to determine idleness.
 */
export function useActivityKeepAwake(tag: string = 'global-keep-awake') {
  useEffect(() => {
    const handleIdleChange = (isIdle: boolean) => {
      if (isIdle) {
        console.log('[useActivityKeepAwake] App is idle, deactivating keep-awake.');
        deactivateKeepAwake(tag);
      } else {
        console.log('[useActivityKeepAwake] App is active, activating keep-awake.');
        activateKeepAwake(tag);
      }
    };

    // When the component mounts, if the app is not idle, we should activate keep awake.
    if (!appStateManager.isIdle()) {
        activateKeepAwake(tag);
    }

    // Subscribe to future idle state changes
    const unsubscribe = appStateManager.subscribeToIdle(handleIdleChange);

    // Cleanup on unmount
    return () => {
      console.log('[useActivityKeepAwake] Cleaning up, deactivating keep-awake.');
      unsubscribe();
      deactivateKeepAwake(tag); // Ensure it's deactivated on unmount
    };
  }, [tag]);
}
