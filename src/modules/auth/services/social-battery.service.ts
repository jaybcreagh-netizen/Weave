import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import { Q } from '@nozbe/watermelondb';

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

        // Trigger smart notification evaluation after battery check-in
        try {
            const { SmartSuggestionsChannel, BatteryCheckinChannel } = await import('@/modules/notifications');

            // 1. Reschedule "Social Battery" notification (Safety Net)
            const batteryTime = profile.batteryCheckinTime || '20:00';
            await BatteryCheckinChannel.rescheduleForTomorrow(batteryTime);

            // 2. Evaluate other smart notifications
            await SmartSuggestionsChannel.evaluateAndSchedule();
        } catch (error) {
            console.error('Error evaluating smart notifications after battery check-in:', error);
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
        const { BatteryCheckinChannel } = await import('@/modules/notifications');
        if (enabled) {
            await BatteryCheckinChannel.schedule(time || '20:00');
        } else {
            await BatteryCheckinChannel.cancel();
        }
    }
};
