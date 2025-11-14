import { create } from 'zustand';
import {
  BackgroundSyncSettings,
  getBackgroundSyncSettings,
  saveBackgroundSyncSettings,
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
  getBackgroundFetchStatus,
  triggerManualSync,
} from '../lib/background-event-sync';
import { requestNotificationPermissions } from '../lib/event-notifications';
import * as BackgroundFetch from 'expo-background-fetch';

interface BackgroundSyncStore {
  // Settings
  settings: BackgroundSyncSettings;
  isLoading: boolean;
  backgroundFetchStatus: BackgroundFetch.BackgroundFetchStatus | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<BackgroundSyncSettings>) => Promise<void>;
  toggleEnabled: () => Promise<boolean>;
  checkBackgroundFetchStatus: () => Promise<void>;
  testManualSync: () => Promise<void>;
}

/**
 * Store for managing background calendar sync settings
 */
export const useBackgroundSyncStore = create<BackgroundSyncStore>((set, get) => ({
  settings: {
    enabled: false,
    scanIntervalHours: 24,
    scanPastDays: 2,
    minImportance: 'medium',
    notificationsEnabled: true,
    lastSyncTimestamp: null,
  },
  isLoading: false,
  backgroundFetchStatus: null,

  /**
   * Load settings from storage
   */
  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await getBackgroundSyncSettings();
      const status = await getBackgroundFetchStatus();
      set({ settings, backgroundFetchStatus: status, isLoading: false });
    } catch (error) {
      console.error('[BackgroundSyncStore] Error loading settings:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Update settings and persist to storage
   */
  updateSettings: async (updates: Partial<BackgroundSyncSettings>) => {
    const currentSettings = get().settings;
    const newSettings = { ...currentSettings, ...updates };

    // If enabling notifications, request permission first
    if (updates.notificationsEnabled && !currentSettings.notificationsEnabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.log('[BackgroundSyncStore] Notification permission denied');
        return;
      }
    }

    // Save to storage
    await saveBackgroundSyncSettings(updates);

    // Update local state
    set({ settings: newSettings });

    // Refresh background fetch status
    const status = await getBackgroundFetchStatus();
    set({ backgroundFetchStatus: status });
  },

  /**
   * Toggle background sync on/off
   */
  toggleEnabled: async () => {
    const currentSettings = get().settings;
    const newEnabled = !currentSettings.enabled;

    // If enabling, check permissions first
    if (newEnabled) {
      // Check notification permissions
      const notificationGranted = await requestNotificationPermissions();
      if (!notificationGranted) {
        console.log('[BackgroundSyncStore] Cannot enable - notification permission required');
        return false;
      }

      // Check background fetch status
      const status = await getBackgroundFetchStatus();
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.log('[BackgroundSyncStore] Cannot enable - background fetch restricted');
        return false;
      }

      // Register task
      const registered = await registerBackgroundSyncTask();
      if (!registered) {
        console.log('[BackgroundSyncStore] Failed to register background task');
        return false;
      }
    } else {
      // Unregister task
      await unregisterBackgroundSyncTask();
    }

    // Update settings
    await get().updateSettings({ enabled: newEnabled });

    console.log(`[BackgroundSyncStore] Background sync ${newEnabled ? 'enabled' : 'disabled'}`);
    return true;
  },

  /**
   * Check background fetch availability status
   */
  checkBackgroundFetchStatus: async () => {
    try {
      const status = await getBackgroundFetchStatus();
      set({ backgroundFetchStatus: status });
      return status;
    } catch (error) {
      console.error('[BackgroundSyncStore] Error checking background fetch status:', error);
      return null;
    }
  },

  /**
   * Manually trigger a sync (for testing/debugging)
   */
  testManualSync: async () => {
    try {
      console.log('[BackgroundSyncStore] Triggering manual sync...');
      await triggerManualSync();

      // Update last sync timestamp
      await get().updateSettings({ lastSyncTimestamp: Date.now() });

      console.log('[BackgroundSyncStore] Manual sync completed');
    } catch (error) {
      console.error('[BackgroundSyncStore] Error during manual sync:', error);
    }
  },
}));

/**
 * Get human-readable background fetch status
 */
export function getBackgroundFetchStatusLabel(
  status: BackgroundFetch.BackgroundFetchStatus | null
): string {
  if (status === null) return 'Unknown';

  switch (status) {
    case BackgroundFetch.BackgroundFetchStatus.Available:
      return 'Available';
    case BackgroundFetch.BackgroundFetchStatus.Denied:
      return 'Denied';
    case BackgroundFetch.BackgroundFetchStatus.Restricted:
      return 'Restricted (Battery Saver or Low Power Mode)';
    default:
      return 'Unknown';
  }
}
