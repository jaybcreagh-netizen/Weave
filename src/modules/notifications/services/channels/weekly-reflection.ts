
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
        const { useUIStore } = require('@/stores/uiStore');

        setTimeout(() => {
            useUIStore.getState().openWeeklyReflection();
            notificationAnalytics.trackActionCompleted('weekly-reflection', 'open_modal');
        }, 500);
    }
};
