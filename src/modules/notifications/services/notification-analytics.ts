import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from '@/shared/services/analytics.service';
import Logger from '@/shared/utils/Logger';

// Feature flag - set to true to enable analytics
const ANALYTICS_ENABLED = true;

// Storage keys
const NOTIFICATION_CORRELATION_KEY = '@weave:notification_correlation';

// Types of notifications we track
export type NotificationType =
    | 'battery-checkin'
    | 'weekly-reflection'
    | 'event-reminder'
    | 'deepening-nudge'
    | 'friend-suggestion'
    | 'memory-nudge'
    | 'event-suggestion'
    | 'life-event'
    | 'portfolio-insight'
    | 'evening-digest'
    | 'plan_reminder';

export interface NotificationEventProperties {
    type: NotificationType;
    notificationId: string;
    [key: string]: any;
}

interface CorrelationData {
    scheduledAt: number;
    type: NotificationType;
}

class NotificationAnalyticsService {
    /**
     * Track when a notification is scheduled
     */
    async trackScheduled(
        type: NotificationType,
        notificationId: string,
        properties: Record<string, any> = {}
    ): Promise<void> {
        if (!ANALYTICS_ENABLED) return;

        try {
            // 1. Track the event
            trackEvent('notification_scheduled', {
                type,
                notificationId,
                ...properties,
            });

            // 2. Store correlation data
            await this.storeCorrelationData(notificationId, type);
        } catch (error) {
            // Fail silently to not impact app performance
            Logger.warn('[NotificationAnalytics] Error tracking scheduled:', error);
        }
    }

    /**
     * Track when a notification is tapped
     */
    async trackTapped(
        type: NotificationType,
        notificationId: string,
        properties: Record<string, any> = {}
    ): Promise<void> {
        if (!ANALYTICS_ENABLED) return;

        try {
            // 1. Get correlation data to calculate time-to-tap
            const correlation = await this.getCorrelationData(notificationId);
            let secondsSinceScheduled: number | undefined;

            if (correlation) {
                const now = Date.now();
                secondsSinceScheduled = Math.floor((now - correlation.scheduledAt) / 1000);
            }

            // 2. Track the event
            trackEvent('notification_tapped', {
                type,
                notificationId,
                secondsSinceScheduled,
                ...properties,
            });

            // 3. Cleanup is handled periodically, not here, so we can track subsequent actions
        } catch (error) {
            Logger.warn('[NotificationAnalytics] Error tracking tapped:', error);
        }
    }

    /**
     * Track when a notification action is completed (conversion)
     */
    trackActionCompleted(
        type: NotificationType,
        action: string,
        notificationId?: string,
        properties: Record<string, any> = {}
    ): void {
        if (!ANALYTICS_ENABLED) return;

        trackEvent('notification_action_completed', {
            type,
            notificationId,
            action,
            ...properties,
        });
    }

    /**
     * Track when a notification is cancelled
     */
    trackCancelled(
        type: NotificationType,
        reason: string,
        properties: Record<string, any> = {}
    ): void {
        if (!ANALYTICS_ENABLED) return;

        trackEvent('notification_cancelled', {
            type,
            reason,
            ...properties,
        });
    }

    /**
     * Track permission request flows
     */
    trackPermissionRequested(source: string): void {
        if (!ANALYTICS_ENABLED) return;

        trackEvent('notification_permission_requested', {
            source,
        });
    }

    /**
     * Track permission result
     */
    trackPermissionResult(granted: boolean, canAskAgain: boolean): void {
        if (!ANALYTICS_ENABLED) return;

        trackEvent('notification_permission_result', {
            granted,
            canAskAgain,
        });
    }

    /**
     * Track when user explicitly dismisses/skips permission
     */
    trackPermissionSkipped(source: string): void {
        if (!ANALYTICS_ENABLED) return;

        trackEvent('notification_permission_skipped', {
            source,
        });
    }

    // ==============================================================================
    // Correlation Helper Methods (Private)
    // ==============================================================================

    private async storeCorrelationData(notificationId: string, type: NotificationType): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATION_CORRELATION_KEY);
            const data: Record<string, CorrelationData> = stored ? JSON.parse(stored) : {};

            // Add new entry
            data[notificationId] = {
                scheduledAt: Date.now(),
                type,
            };

            // Cleanup old entries (older than 7 days)
            const now = Date.now();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

            Object.keys(data).forEach(key => {
                if (now - data[key].scheduledAt > sevenDaysMs) {
                    delete data[key];
                }
            });

            await AsyncStorage.setItem(NOTIFICATION_CORRELATION_KEY, JSON.stringify(data));
        } catch (error) {
            // Ignore storage errors
        }
    }

    private async getCorrelationData(notificationId: string): Promise<CorrelationData | null> {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATION_CORRELATION_KEY);
            if (!stored) return null;

            const data: Record<string, CorrelationData> = JSON.parse(stored);
            return data[notificationId] || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Track when a notification is shown in foreground
     */
    trackForegroundShown(type: NotificationType): void {
        if (!ANALYTICS_ENABLED) return;
        trackEvent('notification_foreground_shown', { type });
    }
}

export const notificationAnalytics = new NotificationAnalyticsService();
