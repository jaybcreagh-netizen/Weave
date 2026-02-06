import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { NotificationChannel } from '@/modules/notifications';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { isTemporaryUsername } from '@/shared/utils/username-utils';

const ID_PREFIX = 'username-nudge';

async function getScheduledUsernameNudges() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter(n =>
        n.identifier === ID_PREFIX ||
        n.identifier.startsWith(`${ID_PREFIX}-`) ||
        n.content?.data?.type === 'username-nudge'
    );
}

async function fetchUsernameFromSupabase(userId?: string): Promise<string> {
    try {
        const client = getSupabaseClient();
        if (!client) return '';

        // If we have a userId from local profile, use it
        // Otherwise fall back to auth.getUser()
        let authUserId = userId;

        if (!authUserId) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return '';
            authUserId = user.id;
        }

        // Preferred query for current schema (id = auth user id)
        const { data: byId } = await client
            .from('user_profiles')
            .select('username')
            .eq('id', authUserId)
            .maybeSingle();

        if (byId?.username) return byId.username;

        // Legacy fallback: some environments store auth id in user_id
        const { data: byUserId } = await client
            .from('user_profiles')
            .select('username')
            .eq('user_id', authUserId)
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

/**
 * Get the current user's profile, matching by userId when possible.
 * Falls back to first profile only if no userId is available from auth.
 */
async function getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
        const client = getSupabaseClient();
        let authUserId: string | null = null;

        if (client) {
            try {
                const { data: { user } } = await client.auth.getUser();
                authUserId = user?.id || null;
            } catch {
                // Auth not available yet, fall back to first profile
            }
        }

        const profiles = await database.get<UserProfile>('user_profile').query().fetch();

        if (profiles.length === 0) return null;

        // If we have an auth user ID, try to match
        if (authUserId) {
            const matchingProfile = profiles.find(p => p.userId === authUserId);
            if (matchingProfile) return matchingProfile;
        }

        // Fallback: if only one profile exists, use it
        // (single-account mode or auth not yet restored)
        if (profiles.length === 1) {
            return profiles[0];
        }

        // Multiple profiles and no auth match - don't guess
        Logger.warn('[UsernameNudge] Multiple profiles found but no auth match, skipping nudge');
        return null;
    } catch (e) {
        Logger.error('[UsernameNudge] Error getting current user profile:', e);
        return null;
    }
}

export const UsernameNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            // 1. Get the current user's profile (matched by userId when possible)
            const profile = await getCurrentUserProfile();

            if (!profile) {
                Logger.debug('[UsernameNudge] No profile found, skipping');
                return;
            }

            // Check local first, then fallback to Supabase
            // (handles case where username was set but not synced locally yet)
            let currentUsername = profile.username || '';

            if (isTemporaryUsername(currentUsername)) {
                // Local DB might be stale - check Supabase
                const remoteUsername = await fetchUsernameFromSupabase(profile.userId);
                if (remoteUsername) {
                    currentUsername = remoteUsername;
                    Logger.info('[UsernameNudge] Fetched username from Supabase:', currentUsername);

                    // Try to sync the username back to local profile
                    try {
                        await database.write(async () => {
                            await profile.update(p => {
                                p.username = remoteUsername;
                            });
                        });
                        Logger.info('[UsernameNudge] Synced username to local profile');
                    } catch (syncError) {
                        // Non-fatal, sync will eventually fix it
                        Logger.warn('[UsernameNudge] Failed to sync username locally:', syncError);
                    }
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

        if (scheduled.length > 0) {
            Logger.info('[UsernameNudge] Cancelled', scheduled.length, 'scheduled nudge(s)');
        }
    },

    handleTap: async (data: any, router: any) => {
        // Just open the app -> dashboard -> the Sheet will auto-open
        router.replace('/dashboard');
    }
};

/**
 * Call this when a username is successfully claimed to cancel any pending nudge.
 * Exported separately for use by username mutation handlers.
 */
export async function cancelUsernameNudgeOnClaim(): Promise<void> {
    await UsernameNudgeChannel.cancel();
}
