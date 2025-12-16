
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

const ID = 'weekly-reflection';

export const WeeklyReflectionChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            await Notifications.cancelScheduledNotificationAsync(ID);

            const grace = await shouldSendWeeklyReflectionNotification();
            if (!grace.shouldSend) return;

            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];
            const reflectionDayIndex = profile?.reflectionDay ?? 0; // 0 = Sunday
            const expoWeekday = reflectionDayIndex + 1; // 1 = Sunday

            await Notifications.scheduleNotificationAsync({
                identifier: ID,
                content: {
                    title: "Time to reflect on your weave 🕸️",
                    body: "How did your friendships feel this week?",
                    data: { type: 'weekly-reflection' },
                },
                trigger: {
                    weekday: expoWeekday,
                    hour: 19,
                    minute: 0,
                    repeats: true,
                } as any,
            });

            await notificationAnalytics.trackScheduled('weekly-reflection', ID, {
                dayOfWeek: expoWeekday
            });
        } catch (error) {
            Logger.error('[WeeklyReflection] Error scheduling:', error);
        }
    },

    cancel: async (id: string = ID): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(id);
    },

    handleTap: (data, router) => {
        if (router.canGoBack()) router.dismissAll();
        router.replace('/dashboard');

        // Open modal via store
        const { useUIStore } = require('@/shared/stores/uiStore');

        setTimeout(() => {
            useUIStore.getState().openWeeklyReflection();
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
