import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { scanCalendarEvents, CalendarService } from '@/modules/interactions';
import { database } from '@/db';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sync } from '@/shared/services/sync.service';
import { scheduleEventSuggestionNotification } from '@/modules/notifications';
import Logger from '@/shared/utils/Logger';

// Task identifier
const BACKGROUND_EVENT_SYNC_TASK = 'BACKGROUND_EVENT_SYNC';

// Settings key
const BACKGROUND_SYNC_SETTINGS_KEY = '@weave_background_sync_settings';

/**
 * Background sync settings
 */
export interface BackgroundSyncSettings {
  enabled: boolean;
  scanIntervalHours: number; // How often to scan (default: 24 hours)
  scanPastDays: number; // How many days back to scan (default: 2)
  minImportance: 'low' | 'medium' | 'high' | 'critical'; // Filter events by importance
  notificationsEnabled: boolean; // Send push notifications for suggestions
  lastSyncTimestamp: number | null;
}

export const DEFAULT_SETTINGS: BackgroundSyncSettings = {
  enabled: false, // Off by default - user must opt in
  scanIntervalHours: 24, // Once per day
  scanPastDays: 2, // Look back 2 days
  minImportance: 'medium', // Only medium+ importance events
  notificationsEnabled: true,
  lastSyncTimestamp: null,
};

/**
 * Get background sync settings
 */
export async function getBackgroundSyncSettings(): Promise<BackgroundSyncSettings> {
  try {
    const settings = await AsyncStorage.getItem(BACKGROUND_SYNC_SETTINGS_KEY);
    return settings ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) } : DEFAULT_SETTINGS;
  } catch (error) {
    Logger.error('[BackgroundSync] Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save background sync settings
 */
export async function saveBackgroundSyncSettings(settings: Partial<BackgroundSyncSettings>): Promise<void> {
  try {
    const current = await getBackgroundSyncSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(BACKGROUND_SYNC_SETTINGS_KEY, JSON.stringify(updated));

    // If enabled state changed, register/unregister task
    if (settings.enabled !== undefined) {
      if (settings.enabled) {
        await registerBackgroundSyncTask();
      } else {
        await unregisterBackgroundSyncTask();
      }
    }
  } catch (error) {
    Logger.error('[BackgroundSync] Error saving settings:', error);
  }
}

/**
 * Check if background sync is enabled
 */
export async function isBackgroundSyncEnabled(): Promise<boolean> {
  const settings = await getBackgroundSyncSettings();
  return settings.enabled;
}

/**
 * Background task that scans calendar for past events
 * This runs periodically in the background
 */
TaskManager.defineTask(BACKGROUND_EVENT_SYNC_TASK, async () => {
  try {
    Logger.info('[BackgroundSync] Starting background event scan...');

    // Check if feature is enabled
    const settings = await getBackgroundSyncSettings();
    if (!settings.enabled) {
      Logger.info('[BackgroundSync] Feature disabled, skipping scan');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Perform database sync
    try {
      await sync();
      Logger.info('[BackgroundSync] Native sync completed');
    } catch (error) {
      Logger.error('[BackgroundSync] Native sync failed:', error);
    }

    // Check if calendar integration is enabled
    const calendarSettings = await CalendarService.getCalendarSettings();
    if (!calendarSettings.enabled || !calendarSettings.twoWaySync) {
      Logger.info('[BackgroundSync] Calendar sync disabled, skipping scan');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Calculate scan window
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - settings.scanPastDays);

    // Scan calendar events
    const scanResult = await scanCalendarEvents({
      startDate,
      endDate: now,
      includeWeaveEvents: false,
      minImportance: settings.minImportance,
    });

    Logger.info(`[BackgroundSync] Scanned ${scanResult.totalScanned} events, found ${scanResult.matchedEvents} with friend matches`);

    // Process matched events
    // NOTE: Regular events are handled in weekly reflection (no notifications)
    // Only send immediate notifications for life events (birthdays, anniversaries)
    let suggestionsCreated = 0;
    for (const event of scanResult.events) {
      if (event.matchedFriends.length === 0) continue;

      // Check if we've already suggested this event
      const alreadySuggested = await checkIfEventAlreadySuggested(event.id);
      if (alreadySuggested) {
        Logger.debug(`[BackgroundSync] Skipping already-suggested event: ${event.title}`);
        continue;
      }

      // Track that we've seen this event
      await trackSuggestedEvent(event.id, event.matchedFriends.map(m => m.friend.id));

      // Only send immediate notifications for time-sensitive life events
      const isLifeEvent = event.eventType === 'birthday' ||
        event.eventType === 'anniversary' ||
        event.holidayName !== undefined;

      if (isLifeEvent && settings.notificationsEnabled) {
        await scheduleEventSuggestionNotification(event);
        suggestionsCreated++;
        Logger.info(`[BackgroundSync] Scheduled notification for life event: ${event.title}`);
      } else {
        // Regular events will be shown in weekly reflection
        Logger.debug(`[BackgroundSync] Event "${event.title}" will appear in weekly reflection`);
      }
    }

    // Update last sync timestamp
    await saveBackgroundSyncSettings({ lastSyncTimestamp: Date.now() });

    Logger.info(`[BackgroundSync] Completed. Created ${suggestionsCreated} suggestions.`);

    return suggestionsCreated > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (error) {
    Logger.error('[BackgroundSync] Error during background sync:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Check if an event has already been suggested to avoid duplicates
 */
async function checkIfEventAlreadySuggested(eventId: string): Promise<boolean> {
  try {
    const key = `@weave_suggested_event_${eventId}`;
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  } catch (error) {
    Logger.error('[BackgroundSync] Error checking suggested events:', error);
    return false;
  }
}

/**
 * Track that we've suggested an event
 */
async function trackSuggestedEvent(eventId: string, friendIds: string[]): Promise<void> {
  try {
    const key = `@weave_suggested_event_${eventId}`;
    const data = {
      suggestedAt: Date.now(),
      friendIds,
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));

    // Also log to database for analytics
    await database.write(async () => {
      for (const friendId of friendIds) {
        await database.get<SuggestionEvent>('suggestion_events').create((record) => {
          record.suggestionId = `calendar-event-${eventId}`;
          record.friendId = friendId;
          record.suggestionType = 'calendar-event';
          record.urgency = 'medium';
          record.actionType = 'log';
          record.eventType = 'shown';
          record.eventTimestamp = new Date();
        });
      }
    });
  } catch (error) {
    Logger.error('[BackgroundSync] Error tracking suggested event:', error);
  }
}

/**
 * Register the background sync task
 */
export async function registerBackgroundSyncTask(): Promise<boolean> {
  try {
    const settings = await getBackgroundSyncSettings();

    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_SYNC_TASK);

    if (isRegistered) {
      Logger.info('[BackgroundSync] Task already registered');
      return true;
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_EVENT_SYNC_TASK, {
      minimumInterval: settings.scanIntervalHours * 60 * 60, // Convert hours to seconds
      stopOnTerminate: false, // Continue after app is killed
      startOnBoot: true, // Start when device boots
    });

    Logger.info('[BackgroundSync] Task registered successfully');
    return true;
  } catch (error) {
    Logger.error('[BackgroundSync] Error registering background task:', error);
    return false;
  }
}

/**
 * Unregister the background sync task
 */
export async function unregisterBackgroundSyncTask(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_SYNC_TASK);

    if (!isRegistered) {
      Logger.info('[BackgroundSync] Task not registered, nothing to unregister');
      return true;
    }

    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_EVENT_SYNC_TASK);
    Logger.info('[BackgroundSync] Task unregistered successfully');
    return true;
  } catch (error) {
    Logger.error('[BackgroundSync] Error unregistering background task:', error);
    return false;
  }
}

/**
 * Get background fetch status (for debugging)
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    return status ?? BackgroundFetch.BackgroundFetchStatus.Restricted;
  } catch (error) {
    Logger.error('[BackgroundSync] Error getting background fetch status:', error);
    return BackgroundFetch.BackgroundFetchStatus.Restricted;
  }
}

/**
 * Manually trigger a background sync (for testing)
 */
export async function triggerManualSync(): Promise<void> {
  try {
    Logger.info('[BackgroundSync] Triggering manual sync...');
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_SYNC_TASK);

    if (!isRegistered) {
      Logger.info('[BackgroundSync] Task not registered, registering first...');
      await registerBackgroundSyncTask();
    }

    // Manually execute the task
    await TaskManager.getTaskOptionsAsync(BACKGROUND_EVENT_SYNC_TASK);
    Logger.info('[BackgroundSync] Manual sync triggered');
  } catch (error) {
    Logger.error('[BackgroundSync] Error triggering manual sync:', error);
  }
}

/**
 * Clean up old suggested event records (keep last 30 days)
 */
export async function cleanupOldSuggestedEvents(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const eventKeys = keys.filter(k => k.startsWith('@weave_suggested_event_'));
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    for (const key of eventKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.suggestedAt < thirtyDaysAgo) {
          await AsyncStorage.removeItem(key);
        }
      }
    }

    Logger.info('[BackgroundSync] Cleaned up old suggested events');
  } catch (error) {
    Logger.error('[BackgroundSync] Error cleaning up suggested events:', error);
  }
}
