
/**
 * Notification Store
 * Centralized AsyncStorage management for the notification system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '@/shared/utils/Logger';
import { NotificationPreferences } from '../types';

// Storage Keys
const KEYS = {
    // Grace Period / Init
    NOTIFICATIONS_INITIALIZED: '@weave:notifications_initialized',

    // Weekly Reflection
    LAST_REFLECTION_DATE: '@weave:last_reflection_date',

    // Deepening Nudges
    DEEPENING_NUDGES: '@weave:deepening_nudges',

    // Memory Nudges
    LAST_MEMORY_CHECK: '@weave:last_memory_check',

    // Smart Notifications
    LAST_SMART_NOTIFICATION: '@weave:last_smart_notification',
    SMART_NOTIFICATION_COUNT: '@weave:smart_notification_count',
    SCHEDULED_SMART_NOTIFICATIONS: '@weave:scheduled_smart_notifications',
    NOTIFICATION_PREFERENCES: '@weave:notification_preferences',

    // Permissions
    PERMISSION_REQUESTED: '@weave:notification_permission_requested',

    // Analytics
    CORRELATION: '@weave:notification_correlation',
} as const;

// Default Preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
    frequency: 'moderate',
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 8, // 8 AM
    respectBattery: true,
    digestEnabled: true,
    digestTime: '19:00',
};

class NotificationStoreService {
    /**
     * Initialize or reset state
     */
    async clearAll(): Promise<void> {
        try {
            const keys = Object.values(KEYS);
            await AsyncStorage.multiRemove(keys);
            Logger.info('[NotificationStore] All notification state cleared');
        } catch (error) {
            Logger.error('[NotificationStore] Error clearing state:', error);
        }
    }

    // ==============================================================================
    // Initialization
    // ==============================================================================

    async getInitializationDate(): Promise<Date | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_INITIALIZED);
            return val ? new Date(parseInt(val, 10)) : null;
        } catch (e) { return null; }
    }

    async markAsInitialized(): Promise<void> {
        await AsyncStorage.setItem(KEYS.NOTIFICATIONS_INITIALIZED, Date.now().toString());
    }

    // ==============================================================================
    // Weekly Reflection
    // ==============================================================================

    async getLastReflectionDate(): Promise<Date | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.LAST_REFLECTION_DATE);
            return val ? new Date(val) : null;
        } catch (e) { return null; }
    }

    async setLastReflectionDate(date: Date): Promise<void> {
        await AsyncStorage.setItem(KEYS.LAST_REFLECTION_DATE, date.toISOString());
    }

    // ==============================================================================
    // Deepening Nudges
    // ==============================================================================

    async getDeepeningNudges(): Promise<any[]> {
        try {
            const val = await AsyncStorage.getItem(KEYS.DEEPENING_NUDGES);
            return val ? JSON.parse(val) : [];
        } catch (e) { return []; }
    }

    async setDeepeningNudges(nudges: any[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.DEEPENING_NUDGES, JSON.stringify(nudges));
    }

    // ==============================================================================
    // Memory Nudges
    // ==============================================================================

    async getLastMemoryCheckDate(): Promise<string | null> {
        return await AsyncStorage.getItem(KEYS.LAST_MEMORY_CHECK);
    }

    async setLastMemoryCheckDate(dateStr: string): Promise<void> {
        await AsyncStorage.setItem(KEYS.LAST_MEMORY_CHECK, dateStr);
    }

    // ==============================================================================
    // Smart Notifications
    // ==============================================================================

    async getLastSmartNotificationTime(): Promise<number | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.LAST_SMART_NOTIFICATION);
            return val ? parseInt(val, 10) : null;
        } catch (e) { return null; }
    }

    async setLastSmartNotificationTime(timestamp: number): Promise<void> {
        await AsyncStorage.setItem(KEYS.LAST_SMART_NOTIFICATION, timestamp.toString());
    }

    async getSmartNotificationCount(): Promise<{ date: string; count: number } | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.SMART_NOTIFICATION_COUNT);
            return val ? JSON.parse(val) : null;
        } catch (e) { return null; }
    }

    async setSmartNotificationCount(date: string, count: number): Promise<void> {
        await AsyncStorage.setItem(KEYS.SMART_NOTIFICATION_COUNT, JSON.stringify({ date, count }));
    }

    async getScheduledSmartNotifications(): Promise<{ date: string; ids: string[] } | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.SCHEDULED_SMART_NOTIFICATIONS);
            return val ? JSON.parse(val) : null;
        } catch (e) { return null; }
    }

    async setScheduledSmartNotifications(date: string, ids: string[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.SCHEDULED_SMART_NOTIFICATIONS, JSON.stringify({ date, ids }));
    }

    async getPreferences(): Promise<NotificationPreferences> {
        try {
            const val = await AsyncStorage.getItem(KEYS.NOTIFICATION_PREFERENCES);
            if (val) {
                return { ...DEFAULT_PREFERENCES, ...JSON.parse(val) };
            }
        } catch (e) { /* ignore */ }
        return DEFAULT_PREFERENCES;
    }

    async setPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
        try {
            const current = await this.getPreferences();
            const updated = { ...current, ...prefs };
            await AsyncStorage.setItem(KEYS.NOTIFICATION_PREFERENCES, JSON.stringify(updated));
        } catch (e) { Logger.error('[NotificationStore] Error saving prefs', e); }
    }

    // ==============================================================================
    // Permissions
    // ==============================================================================

    async getPermissionRequested(): Promise<boolean> {
        const val = await AsyncStorage.getItem(KEYS.PERMISSION_REQUESTED);
        return val === 'true';
    }

    async setPermissionRequested(requested: boolean): Promise<void> {
        await AsyncStorage.setItem(KEYS.PERMISSION_REQUESTED, requested ? 'true' : 'false');
    }
}

export const notificationStore = new NotificationStoreService();
