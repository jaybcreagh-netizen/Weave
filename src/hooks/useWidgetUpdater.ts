/**
 * Widget Updater Hook
 * Manages iOS home screen widget updates
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { appStateManager } from '../lib/app-state-manager';
import { updateWidget } from '../lib/widget-updater';

/**
 * Hook to automatically update widget on app lifecycle events
 * Also provides manual update function
 */
export const useWidgetUpdater = () => {
  useEffect(() => {
    // Only run on iOS
    if (Platform.OS !== 'ios') {
      return;
    }

    // Update widget when app comes to foreground
    const unsubscribe = appStateManager.subscribe(async (state) => {
      if (state === 'active') {
        console.log('[Widget] App became active, updating widget');
        await updateWidget();
      }
    });

    // Initial update
    updateWidget();

    return () => {
      unsubscribe();
    };
  }, []);

  // Return manual update function for components to call after data changes
  return {
    updateWidget: Platform.OS === 'ios' ? updateWidget : async () => {},
  };
};

/**
 * Standalone function to trigger widget update
 * Use this in places where hooks can't be used
 */
export const triggerWidgetUpdate = async () => {
  if (Platform.OS === 'ios') {
    await updateWidget();
  }
};
