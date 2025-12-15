
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

            // Check if we missed it (e.g. it's Mon/Tue and we haven't reflected)
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];
            if (!profile) return;

            // Logic: If today is Mon-Wed, and last reflection was > 7 days ago, send a nudgy "Missed it?"
            // This is a "make up" notification
            const now = new Date();
            const day = now.getDay(); // 0-6
            const isCatchUpDays = day >= 1 && day <= 3; // Mon, Tue, Wed

            if (isCatchUpDays) {
                const lastReflected = profile.seasonLastCalculated ? new Date(profile.seasonLastCalculated) : new Date(0);
                const daysSince = (now.getTime() - lastReflected.getTime()) / (1000 * 60 * 60 * 24);

                if (daysSince > 7) {
                    // Check if we already sent a catchup today
                    const scheduledCatchup = scheduled.find(n => n.identifier === `${ID}-catchup`);
                    if (!scheduledCatchup) {
                        const prefs = await notificationStore.getPreferences();
                        const currentHour = now.getHours();

                        // Simple quiet hours check
                        let isQuiet = false;
                        if (prefs.quietHoursStart > prefs.quietHoursEnd) {
                            isQuiet = currentHour >= prefs.quietHoursStart || currentHour < prefs.quietHoursEnd;
                        } else {
                            isQuiet = currentHour >= prefs.quietHoursStart && currentHour < prefs.quietHoursEnd;
                        }

                        let trigger: any = null; // Immediate
                        if (isQuiet) {
                            // Schedule for 9 AM today (or tomorrow if past 9 AM? Background runs often so next morning is fine)
                            // Actually if it's 4 AM, 9 AM is same day. If it's 11 PM, 9 AM is tomorrow.
                            // Simplest: Schedule for 9 AM today. If that's in past, it triggers immediately? No, Expo might fail or fire.
                            // Better: Schedule for 9 AM. If now > 9 AM, use tomorrow 9 AM?
                            // But if run at 4 AM, 9 AM is correct.
                            const nineAm = new Date();
                            nineAm.setHours(9, 0, 0, 0);
                            if (nineAm <= now) {
                                nineAm.setDate(nineAm.getDate() + 1);
                            }
                            trigger = { date: nineAm };
                        }

                        Logger.info('[WeeklyReflection] Scheduling catch-up notification', { isQuiet, trigger });
                        await Notifications.scheduleNotificationAsync({
                            identifier: `${ID}-catchup`,
                            content: {
                                title: "Missed your weekly reflection?",
                                body: "Take a moment to check in with your weave.",
                                data: { type: 'weekly-reflection' },
                            },
                            trigger,
                        });
                    }
                }
            }

        } catch (error) {
            Logger.error('[WeeklyReflection] Error in ensureScheduled:', error);
        }
    }
};
