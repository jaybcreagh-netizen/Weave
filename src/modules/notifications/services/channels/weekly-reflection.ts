
/**
 * Weekly Reflection Channel (SIMPLIFIED)
 * 
 * Handles scheduling of weekly reflection notifications.
 * Uses a SINGLE notification ID pattern for simplicity and reliability.
 * 
 * Key Principles:
 * - One ID only: 'weekly-reflection'
 * - Idempotent scheduling: always cancel ALL related notifications before scheduling
 * - User preference aware: reads reflection day from UserProfile
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '@/modules/notifications';
import { NOTIFICATION_CONFIG } from '../../notification.config';

const ID = 'weekly-reflection';

/**
 * Cancel ALL weekly reflection related notifications
 * This is the nuclear cleanup that ensures no ghosts remain
 */
async function cancelAllWeeklyReflectionNotifications(): Promise<number> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const toCancel = scheduled.filter(n =>
        n.identifier === ID ||
        n.identifier.startsWith('weekly-reflection') ||
        n.content.data?.type === 'weekly-reflection'
    );

    if (toCancel.length > 0) {
        Logger.info(`[WeeklyReflection] Cancelling ${toCancel.length} existing notification(s)`);
        await Promise.all(
            toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
        );
    }

    return toCancel.length;
}

export const WeeklyReflectionChannel: NotificationChannel = {
    /**
     * Schedule the weekly reflection notification.
     * 
     * This is IDEMPOTENT - it will cancel all existing weekly reflection
     * notifications before scheduling a new one.
     */
    schedule: async (): Promise<void> => {
        try {
            const config = NOTIFICATION_CONFIG['weekly-reflection'];
            if (!config.enabled) {
                Logger.info('[WeeklyReflection] Disabled in config');
                return;
            }

            // STEP 1: Nuclear cleanup - cancel ALL related notifications
            await cancelAllWeeklyReflectionNotifications();

            // NOTE: Grace period and "already reflected" checks are intentionally NOT done here.
            // The notification should always be SCHEDULED. Whether it should actually FIRE
            // is determined at delivery time by the notification handler.
            // This ensures the recurring notification persists across app restarts.

            // STEP 2: Get user's preferred day and time
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];

            // UserProfile.reflectionDay: JS convention (0=Sunday, 6=Saturday)
            // Expo CalendarTriggerInput: uses weekday (1=Sunday, 7=Saturday)
            const userReflectionDay = profile?.reflectionDay ?? 0; // Default Sunday
            const weekday = userReflectionDay + 1; // Convert JS → Expo

            const hour = config.schedule.hour ?? 13;
            const minute = config.schedule.minute ?? 0;

            const title = config.templates.default.title;
            const body = config.templates.default.body;

            // STEP 5: Schedule the single recurring notification
            await Notifications.scheduleNotificationAsync({
                identifier: ID,
                content: {
                    title,
                    body,
                    data: { type: 'weekly-reflection' },
                },
                trigger: {
                    weekday,
                    hour,
                    minute,
                    repeats: true,
                } as any,
            });

            await notificationAnalytics.trackScheduled('weekly-reflection', ID, {
                dayOfWeek: weekday,
                hour,
                minute,
            });

            Logger.info(`[WeeklyReflection] Scheduled for weekday ${weekday} at ${hour}:${minute.toString().padStart(2, '0')}`);

        } catch (error) {
            Logger.error('[WeeklyReflection] Error scheduling:', error);
        }
    },

    cancel: async (id: string = ID): Promise<void> => {
        // Cancel specific ID
        await Notifications.cancelScheduledNotificationAsync(id);

        // Also do nuclear cleanup if cancelling the main ID
        if (id === ID) {
            await cancelAllWeeklyReflectionNotifications();
        }
    },

    handleTap: async (data, router) => {
        if (router.canGoBack()) router.dismissAll();
        router.replace('/dashboard');

        // Use UIEventBus to trigger UI action from non-React context
        const { UIEventBus } = await import('@/shared/services/ui-event-bus');

        setTimeout(() => {
            UIEventBus.emit({ type: 'OPEN_WEEKLY_REFLECTION' });
            notificationAnalytics.trackActionCompleted('weekly-reflection', 'open_modal');
        }, 500);
    },

    /**
     * Ensure notification is scheduled.
     * Simply delegates to schedule() which is idempotent.
     */
    ensureScheduled: async (): Promise<void> => {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const hasReflection = scheduled.some(n => n.identifier === ID);

            if (!hasReflection) {
                Logger.info('[WeeklyReflection] Not scheduled, scheduling now...');
                await WeeklyReflectionChannel.schedule();
            } else {
                Logger.info('[WeeklyReflection] Already scheduled');
            }
        } catch (error) {
            Logger.error('[WeeklyReflection] Error in ensureScheduled:', error);
        }
    }
};
