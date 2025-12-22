
/**
 * Weekly Reflection Channel
 * Handles scheduling of Sunday weekly reflection notifications
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { shouldSendWeeklyReflectionNotification } from '../notification-grace-periods';
import { NotificationChannel } from '@/modules/notifications';
import { notificationStore } from '../notification-store';
import { NOTIFICATION_CONFIG } from '../../notification.config';

const ID = 'weekly-reflection';

export const WeeklyReflectionChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            const config = NOTIFICATION_CONFIG['weekly-reflection'];
            if (!config.enabled) {
                Logger.info('[WeeklyReflection] Disabled in config');
                return;
            }

            await Notifications.cancelScheduledNotificationAsync(ID);

            const grace = await shouldSendWeeklyReflectionNotification();
            if (!grace.shouldSend) return;

            // Smart Schedule: Check if reflection is already done for this week
            const { hasCompletedReflectionForCurrentWeek } = await import('@/modules/reflection/services/weekly-reflection.service');
            const isReflected = await hasCompletedReflectionForCurrentWeek();

            const weekday = config.schedule.weekday ?? 1; // 1 = Sunday
            const hour = config.schedule.hour ?? 19;
            const minute = config.schedule.minute ?? 0;

            const now = new Date();
            const isTodayScheduleDay = now.getDay() === (weekday === 1 ? 0 : weekday - 1); // Expo uses 1=Sun, JS uses 0=Sun. Wait.
            // Notifications.CalendarTriggerInput uses 1=Sunday. Date.getDay() uses 0=Sunday.
            // If config.weekday is 1 (Sunday), then we check if Date.getDay() is 0.
            const isSunday = now.getDay() === 0;

            // If reflected AND today is Sunday, we suppress the standard notification
            // But we must ensure next week is covered.
            if (isReflected && isSunday) {
                Logger.info('[WeeklyReflection] Reflection completed for this week. Cancelling clear/schedule normal, scheduling backup for next week.');

                // 1. Cancel standard recurring
                await Notifications.cancelScheduledNotificationAsync(ID);

                // 2. Schedule BACKUP recurring for NEXT Sunday
                // We use a different ID so we can distinguish them
                const BACKUP_ID = `${ID}-backup`;

                // Check if backup is already there
                const scheduled = await Notifications.getAllScheduledNotificationsAsync();
                const hasBackup = scheduled.some(n => n.identifier === BACKUP_ID);

                if (!hasBackup) {
                    await Notifications.scheduleNotificationAsync({
                        identifier: BACKUP_ID,
                        content: {
                            title: config.templates.default.title,
                            body: config.templates.default.body,
                            data: { type: 'weekly-reflection' },
                        },
                        trigger: {
                            weekday: weekday, // Sunday
                            hour: hour,
                            minute: minute,
                            repeats: true,
                        } as any,
                    });
                    Logger.info('[WeeklyReflection] Scheduled backup recurring notification for next week');
                }
                return;
            }

            // Normal Case: specific reflection NOT done OR it's not Sunday (re-syncing)
            // Ensure Backup is cancelled
            await Notifications.cancelScheduledNotificationAsync(`${ID}-backup`);

            // Schedule Standard Recur check
            // We already cancelled ID above (line 28), so just schedule it.

            const title = config.templates.default.title;
            const body = config.templates.default.body;

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
                dayOfWeek: weekday
            });
        } catch (error) {
            Logger.error('[WeeklyReflection] Error scheduling:', error);
        }
    },

    cancel: async (id: string = ID): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(id);
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
     * Ensure reflection is scheduled and check for missed reflections
     * Safe to run in background
     */
    ensureScheduled: async (): Promise<void> => {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const reflectionScheduled = scheduled.find(n => n.identifier === ID);

            // Cleanup ghosts (any notification with type 'weekly-reflection' that isn't the main ID, backup ID, or current catchup ID)
            const ghosts = scheduled.filter(n =>
                n.content.data?.type === 'weekly-reflection' &&
                n.identifier !== ID &&
                n.identifier !== `${ID}-backup` &&
                n.identifier !== `${ID}-catchup`
            );

            if (ghosts.length > 0) {
                Logger.warn(`[WeeklyReflection] Found ${ghosts.length} ghost notifications. Cancelling...`);
                await Promise.all(ghosts.map(g => Notifications.cancelScheduledNotificationAsync(g.identifier)));
            }

            if (!reflectionScheduled) {
                Logger.info('[WeeklyReflection] Not scheduled, scheduling now...');
                await WeeklyReflectionChannel.schedule();
            }



            // Catch-up logic: Only on MONDAYS
            const now = new Date();
            const day = now.getDay(); // 0 = Sunday, 1 = Monday

            if (day === 1) { // Monday only
                const profiles = await database.get<UserProfile>('user_profile').query().fetch();
                const profile = profiles[0];

                if (profile) {
                    const lastReflected = profile.seasonLastCalculated ? new Date(profile.seasonLastCalculated) : new Date(0);
                    const daysSince = (now.getTime() - lastReflected.getTime()) / (1000 * 60 * 60 * 24);

                    // If we haven't reflected in > 7 days (meaning we missed yesterday's Sunday reflection)
                    if (daysSince > 7) {
                        const catchupId = `${ID}-catchup`;
                        const scheduledCatchup = scheduled.find(n => n.identifier === catchupId);

                        if (!scheduledCatchup) {
                            const currentHour = now.getHours();
                            let triggerHour: number | null = null;

                            // Schedule logic:
                            // If early morning -> 9:00 AM
                            // If during day -> 20:00 (8 PM) - avoids 19:00 Evening Brief
                            // If late night -> skip
                            if (currentHour < 9) {
                                triggerHour = 9;
                            } else if (currentHour < 20) {
                                triggerHour = 20;
                            }

                            if (triggerHour !== null) {
                                Logger.info('[WeeklyReflection] Scheduling Monday catch-up', { triggerHour });
                                await Notifications.scheduleNotificationAsync({
                                    identifier: catchupId,
                                    content: {
                                        title: "Missed your Sunday reflection?",
                                        body: "It's Monday—take a moment now to reflect before the new week begins.",
                                        data: { type: 'weekly-reflection', subtype: 'catchup' },
                                    },
                                    trigger: {
                                        hour: triggerHour,
                                        minute: 0,
                                        repeats: false // One-time catch-up
                                    } as any,
                                });
                            }
                        }
                    }
                }
            }


        } catch (error) {
            Logger.error('[WeeklyReflection] Error in ensureScheduled:', error);
        }
    }
};
