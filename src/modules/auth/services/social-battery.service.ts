import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import { Q } from '@nozbe/watermelondb';
import { queryClient } from '@/shared/api/query-client';
import { useDashboardCacheStore } from '@/shared/stores/dashboardCacheStore';
import { SOCIAL_BATTERY_STATS_QUERY_KEY } from '@/modules/auth/hooks/useSocialBatteryStats';

export const SocialBatteryService = {
    /**
     * Submit a social battery check-in
     */
    async submitCheckin(userId: string, value: number, note?: string, customTimestamp?: number, overwriteDay?: boolean): Promise<void> {
        const profileCollection = database.get<UserProfile>('user_profile');
        const profile = await profileCollection.find(userId);

        if (!profile) return;

        const batchOps: any[] = [];
        const now = Date.now();
        const timestamp = customTimestamp || now;

        // If overwriting, delete existing logs for this day
        if (overwriteDay) {
            const startOfDay = new Date(timestamp);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(timestamp);
            endOfDay.setHours(23, 59, 59, 999);

            const logsCollection = database.get<SocialBatteryLog>('social_battery_logs');
            const existingLogs = await logsCollection.query(
                Q.where('user_id', profile.id),
                Q.where('timestamp', Q.gte(startOfDay.getTime())),
                Q.where('timestamp', Q.lte(endOfDay.getTime()))
            ).fetch();

            for (const log of existingLogs) {
                batchOps.push(log.prepareMarkAsDeleted());
            }
        }

        batchOps.push(profile.prepareUpdate(p => {
            // Only update current battery level if adding a check-in for today (last 24h)
            if (!customTimestamp || timestamp >= now - 24 * 60 * 60 * 1000) {
                p.socialBatteryCurrent = value;
                p.socialBatteryLastCheckin = timestamp;
            }
        }));

        // Add to battery logs
        const logsCollection = database.get<SocialBatteryLog>('social_battery_logs');
        batchOps.push(logsCollection.prepareCreate(log => {
            log.userId = profile.id;
            log.value = value;
            log.timestamp = timestamp;
        }));

        await database.write(async () => {
            await database.batch(...batchOps);
        });

        // Keep season/suggestions responsive for service-based check-ins (e.g., calendar backfills).
        useDashboardCacheStore.getState().triggerBatterySeasonRefresh(timestamp);
        void queryClient.invalidateQueries({ queryKey: SOCIAL_BATTERY_STATS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });

        // Trigger smart notification evaluation after battery check-in
        try {
            const { SmartSuggestionsChannel, BatteryCheckinChannel } = require('@/modules/notifications') as {
                SmartSuggestionsChannel: { evaluateAndSchedule: () => Promise<void> };
                BatteryCheckinChannel: { rescheduleForTomorrow: () => Promise<void> };
            };
            const { InteractionManager } = require('react-native') as {
                InteractionManager?: {
                    runAfterInteractions?: (fn: () => void | Promise<void>) => void;
                };
            };

            // Defer heavy work to allow sheet close animation to finish smoothly
            const runAfterInteractions = InteractionManager?.runAfterInteractions;
            const execute = async () => {
                try {
                    // 1. Reschedule "Social Battery" notification (Safety Net)
                    await BatteryCheckinChannel.rescheduleForTomorrow();

                    // 2. Evaluate other smart notifications
                    await SmartSuggestionsChannel.evaluateAndSchedule();
                } catch (innerError) {
                    console.error('Error in deferred notification evaluation:', innerError);
                }
            };

            if (typeof runAfterInteractions === 'function') {
                runAfterInteractions(execute);
            } else {
                void execute();
            }
        } catch (error) {
            console.error('Error initiating smart notifications after battery check-in:', error);
        }
    },

    /**
     * Update battery check-in preferences
     */
    async updatePreferences(userId: string, enabled: boolean, time?: string): Promise<void> {
        const profileCollection = database.get<UserProfile>('user_profile');
        const profile = await profileCollection.find(userId);

        if (!profile) return;

        await database.write(async () => {
            await profile.update(p => {
                p.batteryCheckinEnabled = enabled;
                if (time !== undefined) {
                    p.batteryCheckinTime = time;
                }
            });
        });

        // Update notification schedule
        const { BatteryCheckinChannel } = require('@/modules/notifications') as {
            BatteryCheckinChannel: {
                schedule: () => Promise<void>;
                cancel: () => Promise<void>;
            };
        };
        if (enabled) {
            await BatteryCheckinChannel.schedule();
        } else {
            await BatteryCheckinChannel.cancel();
        }
    }
};
