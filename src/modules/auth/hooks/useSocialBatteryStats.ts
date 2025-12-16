import { useQuery } from '@tanstack/react-query';
import { database } from '@/db';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import { Q } from '@nozbe/watermelondb';
import { useAuth } from '../context/AuthContext';

interface BatteryStats {
    average: number | null;
    trend: 'rising' | 'falling' | 'stable' | null;
}

export function useSocialBatteryStats() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ['social-battery-stats', user?.id],
        queryFn: async (): Promise<BatteryStats> => {
            if (!user) throw new Error('User not logged in');

            const logsCollection = database.get<SocialBatteryLog>('social_battery_logs');
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days history

            const logs = await logsCollection.query(
                Q.where('user_id', user.id),
                Q.where('timestamp', Q.gte(cutoff)),
                Q.sortBy('timestamp', Q.asc)
            ).fetch();

            // Calculate Average (last 7 days)
            const sevenDayCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentLogs = logs.filter(l => l.timestamp >= sevenDayCutoff);
            let average = null;
            if (recentLogs.length > 0) {
                const sum = recentLogs.reduce((acc, log) => acc + log.value, 0);
                average = sum / recentLogs.length;
            }

            // Calculate Trend
            let trend: 'rising' | 'falling' | 'stable' | null = 'stable';
            if (logs.length >= 6) {
                const recent = logs.slice(-6);
                const currentWindow = recent.slice(-3);
                const previousWindow = recent.slice(0, 3);

                const currentAvg = currentWindow.reduce((sum, e) => sum + e.value, 0) / 3;
                const previousAvg = previousWindow.reduce((sum, e) => sum + e.value, 0) / 3;

                if (currentAvg > previousAvg + 0.5) trend = 'rising';
                else if (currentAvg < previousAvg - 0.5) trend = 'falling';
            } else {
                trend = null;
            }

            return { average, trend };
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
