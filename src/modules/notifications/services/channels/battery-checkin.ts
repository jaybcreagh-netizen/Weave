
/**
 * Battery Check-in Channel
 * Handles scheduling and managing of social battery notifications
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { shouldSendSocialBatteryNotification } from '../notification-grace-periods';
import { NotificationChannel } from '@/modules/notifications';
import { NOTIFICATION_CONFIG, NOTIFICATION_TIMING } from '../../notification.config';

const ID_PREFIX = 'daily-battery-checkin';

export const BatteryCheckinChannel: NotificationChannel & {
    rescheduleForTomorrow: () => Promise<void>;
    checkAndExtendBatch: () => Promise<void>;
} = {
    /**
     * Schedule battery check-in notifications for the next batch period.
     * Uses config-driven timing from NOTIFICATION_CONFIG.
     */
    schedule: async (startDate?: Date): Promise<void> => {
        try {
            const config = NOTIFICATION_CONFIG['daily-battery-checkin'];
            if (!config.enabled) {
                Logger.info('[BatteryCheckin] Disabled in config');
                return;
            }

            // Cancel existing to ensure clean slate
            await BatteryCheckinChannel.cancel(ID_PREFIX);

            const gracePeriod = await shouldSendSocialBatteryNotification();
            if (!gracePeriod.shouldSend) {
                Logger.info('[BatteryCheckin] Skipping grace period:', gracePeriod.reason);
                return;
            }

            // Fetch user's preferred time from profile
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];

            let targetHour = config.schedule.hour ?? 8;
            let targetMinute = config.schedule.minute ?? 0;

            // Use user's preference if set
            if (profile?.batteryCheckinTime) {
                const [h, m] = profile.batteryCheckinTime.split(':').map(Number);
                if (!isNaN(h) && !isNaN(m)) {
                    targetHour = h;
                    targetMinute = m;
                }
            }

            // Schedule batch for configured number of days
            const BATCH_DAYS = NOTIFICATION_TIMING.batteryCheckin.batchSizeDays;
            const start = startDate || new Date();

            for (let i = 0; i < BATCH_DAYS; i++) {
                const target = new Date();
                target.setDate(target.getDate() + i);
                target.setHours(targetHour, targetMinute, 0, 0);

                // Skip past
                if (target <= new Date()) continue;

                // Skip before start date
                if (startDate && target < startDate) continue;

                const id = `${ID_PREFIX}-${target.toDateString()}`;

                const title = config.templates.default.title;
                const body = config.templates.default.body;

                await Notifications.scheduleNotificationAsync({
                    identifier: id,
                    content: {
                        title,
                        body,
                        data: { type: 'battery-checkin' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: target
                    },
                });

                await notificationAnalytics.trackScheduled('battery-checkin', id, {
                    targetDate: target.toISOString(),
                    batchSize: BATCH_DAYS
                });
            }

            Logger.info(`[BatteryCheckin] Scheduled batch starting ${start.toDateString()} at ${targetHour}:${targetMinute}`);
        } catch (error) {
            Logger.error('[BatteryCheckin] Error scheduling:', error);
        }
    },

    cancel: async (idPrefix: string = ID_PREFIX): Promise<void> => {
        // Cancel the main recurring ID just in case
        await Notifications.cancelScheduledNotificationAsync(ID_PREFIX);

        // Cancel all batch items
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of scheduled) {
            if (n.identifier.startsWith(idPrefix)) {
                await Notifications.cancelScheduledNotificationAsync(n.identifier);
            }
        }
        await notificationAnalytics.trackCancelled('battery-checkin', 'user_disabled_or_reset');
    },

    handleTap: async (data: any, router: any) => {
        // Navigate to dashboard then open sheet
        if (router.canGoBack()) router.dismissAll();
        router.replace('/dashboard');

        // Use UIEventBus to trigger UI action from non-React context
        const { UIEventBus } = await import('@/shared/services/ui-event-bus');
        setTimeout(() => {
            UIEventBus.emit({ type: 'OPEN_SOCIAL_BATTERY_SHEET' });
            notificationAnalytics.trackActionCompleted('battery-checkin', 'open_sheet');
        }, 500);
    },

    // Specific methods for this channel

    /**
     * Reschedule starting tomorrow (skip today).
     * Uses config timing.
     */
    rescheduleForTomorrow: async (): Promise<void> => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // Cancel just today's instance
        const todayStr = new Date().toDateString();
        await Notifications.cancelScheduledNotificationAsync(`${ID_PREFIX}-${todayStr}`);

        await BatteryCheckinChannel.schedule(tomorrow);
    },

    /**
     * Check if batch needs extending (when app opens).
     * Uses NOTIFICATION_TIMING for minimum days threshold.
     */
    checkAndExtendBatch: async (): Promise<void> => {
        // Check pending notifications
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const batteryNotifs = scheduled.filter(n => n.identifier.startsWith(ID_PREFIX));

        // If fewer than minimum days remaining, extend
        const minDays = NOTIFICATION_TIMING.batteryCheckin.minDaysRemainingForExtend;
        if (batteryNotifs.length < minDays) {
            Logger.info('[BatteryCheckin] Batch running low, extending...');
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];
            if (profile?.batteryCheckinEnabled) {
                await BatteryCheckinChannel.schedule();
            }
        }
    }
};

