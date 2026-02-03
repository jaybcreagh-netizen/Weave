import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { NotificationChannel } from '@/modules/notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { getSupabaseClient } from '@/shared/services/supabase-client';

const ID_PREFIX = 'username-nudge';
const TEMP_USERNAME_REGEX = /^user_?\d{4,10}$/i;

function isTemporaryUsername(username?: string | null): boolean {
    if (!username) return true;
    return TEMP_USERNAME_REGEX.test(username.trim());
}

async function getScheduledUsernameNudges() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter(n =>
        n.identifier === ID_PREFIX ||
        n.identifier.startsWith(`${ID_PREFIX}-`) ||
        n.content?.data?.type === 'username-nudge'
    );
}

async function fetchUsernameFromSupabase(): Promise<string> {
    try {
        const client = getSupabaseClient();
        if (!client) return '';

        const { data: { user } } = await client.auth.getUser();
        if (!user) return '';

        // Preferred query for current schema (id = auth user id)
        const { data: byId } = await client
            .from('user_profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();

        if (byId?.username) return byId.username;

        // Legacy fallback: some environments store auth id in user_id
        const { data: byUserId } = await client
            .from('user_profiles')
            .select('username')
            .eq('user_id', user.id)
            .maybeSingle();

        if (byUserId?.username) {
            Logger.info('[UsernameNudge] Fetched username via legacy user_id lookup:', byUserId.username);
            return byUserId.username;
        }
    } catch (e) {
        Logger.warn('[UsernameNudge] Failed to fetch username from Supabase:', e);
    }

    return '';
}

export const UsernameNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            // 1. Check if user needs nudging
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];

            if (!profile) return;

            // Check local first, then fallback to Supabase
            // (handles case where username was set but not synced locally yet)
            let currentUsername = profile.username || '';

            if (isTemporaryUsername(currentUsername)) {
                // Local DB might be stale - check Supabase
                const remoteUsername = await fetchUsernameFromSupabase();
                if (remoteUsername) {
                    currentUsername = remoteUsername;
                    Logger.info('[UsernameNudge] Fetched username from Supabase:', currentUsername);
                }
            }

            const needsNudge = isTemporaryUsername(currentUsername);

            if (!needsNudge) {
                // If they fixed it, cancel any pending nudge
                await UsernameNudgeChannel.cancel();
                return;
            }

            // 2. Check if already scheduled
            const existing = await getScheduledUsernameNudges();

            if (existing.length > 0) {
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
        const scheduled = await getScheduledUsernameNudges();
        await Promise.all(scheduled.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

        // Backwards compatibility: if platform honors explicit identifier, ensure this is cancelled too.
        await Notifications.cancelScheduledNotificationAsync(ID_PREFIX);
    },

    handleTap: async (data: any, router: any) => {
        // Just open the app -> dashboard -> the Sheet will auto-open
        router.replace('/dashboard');
    }
};
