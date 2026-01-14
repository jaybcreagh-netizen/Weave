import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { NotificationChannel } from '@/modules/notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';

const ID_PREFIX = 'username-nudge';

export const UsernameNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            // 1. Check if user needs nudging
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];

            if (!profile) return;

            const currentUsername = profile.username || '';
            const needsNudge = !currentUsername || currentUsername.startsWith('user_');

            if (!needsNudge) {
                // If they fixed it, cancel any pending nudge
                await UsernameNudgeChannel.cancel();
                return;
            }

            // 2. Check if already scheduled
            const all = await Notifications.getAllScheduledNotificationsAsync();
            const existing = all.find(n => n.identifier === ID_PREFIX);

            if (existing) {
                // Already scheduled, let it ride
                return;
            }

            // 3. Schedule for 24 hours from now
            // We give them a day to settle in before nagging
            const triggerDate = new Date();
            triggerDate.setDate(triggerDate.getDate() + 1);
            triggerDate.setHours(10, 0, 0, 0); // 10 AM next day

            await Notifications.scheduleNotificationAsync({
                identifier: ID_PREFIX,
                content: {
                    title: "Claim your unique handle",
                    body: "You have a temporary username. Choose a custom one to help friends find you!",
                    data: {
                        type: 'username-nudge',
                    },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
                // Note: Casting as any because expo-notifications types can be finicky with Trigger inputs
                // but 'date' is valid for Calendar or Date trigger.
            });

            Logger.info('[UsernameNudge] Scheduled for ' + triggerDate.toISOString());

        } catch (error) {
            Logger.error('[UsernameNudge] Error:', error);
        }
    },

    cancel: async (): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(ID_PREFIX);
    },

    handleTap: async (data: any, router: any) => {
        // Just open the app -> dashboard -> the Sheet will auto-open
        router.replace('/dashboard');
    }
};
