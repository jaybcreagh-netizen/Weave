
/**
 * Notification Store
 * Centralized AsyncStorage management for the notification system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '@/shared/utils/Logger';
import {
    NotificationPreferences,
    StoredDeepeningNudge,
    StoredPendingEvent,
    SmartNotificationStats,
    ScheduledSmartNotifications,
    PendingEventsData,
} from '../types';

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

    // Daily Budget
    DAILY_BUDGET: '@weave:daily_budget',

    // Adaptive Frequency (ignore tracking)
    IGNORE_COUNTS: '@weave:notification_ignore_counts',

    // Digest Batching - pending events to show in evening digest
    PENDING_EVENTS: '@weave:pending_events_for_digest',
} as const;

// Budget limits per frequency setting
const BUDGET_LIMITS = {
    light: 3,
    moderate: 5,
    proactive: 8,
} as const;

// Default Preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
    frequency: 'moderate',
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 8, // 8 AM
    respectBattery: true,
    digestEnabled: true,
    digestTime: '19:00',
    maxDailySuggestions: 10,
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

    async getDeepeningNudges(): Promise<StoredDeepeningNudge[]> {
        try {
            const val = await AsyncStorage.getItem(KEYS.DEEPENING_NUDGES);
            return val ? JSON.parse(val) : [];
        } catch (e) {
            Logger.warn('[NotificationStore] Error reading deepening nudges:', e);
            return [];
        }
    }

    async setDeepeningNudges(nudges: StoredDeepeningNudge[]): Promise<void> {
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

    async getSmartNotificationCount(): Promise<SmartNotificationStats | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.SMART_NOTIFICATION_COUNT);
            return val ? JSON.parse(val) : null;
        } catch (e) {
            Logger.warn('[NotificationStore] Error reading smart notification count:', e);
            return null;
        }
    }

    async setSmartNotificationCount(date: string, count: number): Promise<void> {
        await AsyncStorage.setItem(KEYS.SMART_NOTIFICATION_COUNT, JSON.stringify({ date, count }));
    }

    async getScheduledSmartNotifications(): Promise<ScheduledSmartNotifications | null> {
        try {
            const val = await AsyncStorage.getItem(KEYS.SCHEDULED_SMART_NOTIFICATIONS);
            return val ? JSON.parse(val) : null;
        } catch (e) {
            Logger.warn('[NotificationStore] Error reading scheduled smart notifications:', e);
            return null;
        }
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

    // ==============================================================================
    // Daily Budget
    // ==============================================================================

    async getDailyBudget(): Promise<{ date: string; used: number; limit: number }> {
        try {
            const val = await AsyncStorage.getItem(KEYS.DAILY_BUDGET);
            const prefs = await this.getPreferences();
            const limit = BUDGET_LIMITS[prefs.frequency];
            const today = new Date().toDateString();

            if (val) {
                const data = JSON.parse(val);
                // Reset if different day
                if (data.date !== today) {
                    return { date: today, used: 0, limit };
                }
                return { ...data, limit };
            }
            return { date: today, used: 0, limit };
        } catch (e) {
            return { date: new Date().toDateString(), used: 0, limit: BUDGET_LIMITS.moderate };
        }
    }

    /**
     * Check if budget allows another notification and increment if so.
     * Returns true if notification is allowed, false if budget exhausted.
     */
    async checkAndIncrementBudget(): Promise<boolean> {
        const budget = await this.getDailyBudget();
        if (budget.used >= budget.limit) {
            Logger.info(`[NotificationStore] Budget exhausted: ${budget.used}/${budget.limit}`);
            return false;
        }

        const newBudget = { date: budget.date, used: budget.used + 1 };
        await AsyncStorage.setItem(KEYS.DAILY_BUDGET, JSON.stringify(newBudget));
        Logger.debug(`[NotificationStore] Budget used: ${newBudget.used}/${budget.limit}`);
        return true;
    }

    // ==============================================================================
    // Adaptive Frequency (Ignore Tracking)
    // ==============================================================================

    /**
     * Get consecutive ignore count for a notification type.
     */
    async getIgnoreCount(type: string): Promise<number> {
        try {
            const val = await AsyncStorage.getItem(KEYS.IGNORE_COUNTS);
            if (val) {
                const counts = JSON.parse(val);
                return counts[type] || 0;
            }
        } catch (e) { /* ignore */ }
        return 0;
    }

    /**
     * Increment ignore count for a type (called when notification dismissed/ignored).
     */
    async incrementIgnoreCount(type: string): Promise<void> {
        try {
            const val = await AsyncStorage.getItem(KEYS.IGNORE_COUNTS);
            const counts = val ? JSON.parse(val) : {};
            counts[type] = (counts[type] || 0) + 1;
            await AsyncStorage.setItem(KEYS.IGNORE_COUNTS, JSON.stringify(counts));
            Logger.debug(`[NotificationStore] Ignore count for ${type}: ${counts[type]}`);
        } catch (e) {
            Logger.error('[NotificationStore] Error incrementing ignore count', e);
        }
    }

    /**
     * Reset ignore count for a type (called when user taps notification).
     */
    async resetIgnoreCount(type: string): Promise<void> {
        try {
            const val = await AsyncStorage.getItem(KEYS.IGNORE_COUNTS);
            const counts = val ? JSON.parse(val) : {};
            counts[type] = 0;
            await AsyncStorage.setItem(KEYS.IGNORE_COUNTS, JSON.stringify(counts));
        } catch (e) { /* ignore */ }
    }

    /**
     * Check if notification type should be suppressed due to repeated ignores.
     * Returns true if type has been ignored 3+ times consecutively.
     */
    async isTypeSuppressed(type: string): Promise<boolean> {
        const count = await this.getIgnoreCount(type);
        return count >= 3;
    }

    // ==============================================================================
    // Digest Batching - Pending Events
    // ==============================================================================

    /**
     * Get pending events to show in the evening digest.
     */
    async getPendingEvents(): Promise<StoredPendingEvent[]> {
        try {
            const val = await AsyncStorage.getItem(KEYS.PENDING_EVENTS);
            if (val) {
                const data: PendingEventsData = JSON.parse(val);
                // Only return events from today
                const today = new Date().toDateString();
                if (data.date === today) {
                    return data.events || [];
                }
            }
        } catch (e) {
            Logger.warn('[NotificationStore] Error reading pending events:', e);
        }
        return [];
    }

    /**
     * Add a pending event to be shown in the evening digest.
     */
    async addPendingEvent(event: StoredPendingEvent): Promise<void> {
        try {
            const today = new Date().toDateString();
            const existing = await this.getPendingEvents();

            // Prevent duplicates
            if (existing.some(e => e.eventId === event.eventId)) {
                return;
            }

            const events = [...existing, event];
            await AsyncStorage.setItem(KEYS.PENDING_EVENTS, JSON.stringify({ date: today, events }));
            Logger.debug(`[NotificationStore] Added pending event: ${event.title}`);
        } catch (e) {
            Logger.error('[NotificationStore] Error adding pending event', e);
        }
    }

    /**
     * Clear all pending events (called after digest is shown).
     */
    async clearPendingEvents(): Promise<void> {
        await AsyncStorage.removeItem(KEYS.PENDING_EVENTS);
    }
}

export const notificationStore = new NotificationStoreService();
