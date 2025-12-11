import { database } from '@/db';
import SocialSeasonLog from '@/db/models/SocialSeasonLog';
import UserProfile from '@/db/models/UserProfile';
import { SocialSeason } from '@/modules/intelligence';
import { Q } from '@nozbe/watermelondb';

export const SeasonAnalyticsService = {
    /**
     * Ends the current open season log (if any) and starts a new one.
     */
    transitionSeason: async (newSeason: SocialSeason, isOverride: boolean = false) => {
        try {
            await database.write(async () => {
                const logsCollection = database.get<SocialSeasonLog>('social_season_logs');
                const profileCollection = database.get<UserProfile>('user_profile');

                // 1. Get current profile for battery stats
                const profiles = await profileCollection.query().fetch();
                const profile = profiles[0];
                const currentBattery = profile?.socialBatteryCurrent || 0;

                // 2. Close any currently open logs
                const openLogs = await logsCollection.query(
                    Q.where('end_date', Q.eq(null)) // or undefined/0 depending on how we query nulls
                    // Note: watermelondb query might need specific syntax for null, usually Q.eq(null) works
                ).fetch();

                // For safety, close ALL open logs (should only be one)
                for (const log of openLogs) {
                    await log.update(l => {
                        l.endDate = Date.now();
                        l.batteryEnd = currentBattery;
                    });
                }

                // 3. Create new log
                await logsCollection.create(l => {
                    l.userId = profile?.id || 'user'; // Single user app
                    l.season = newSeason;
                    l.startDate = Date.now();
                    l.manualOverride = isOverride;
                    l.batteryStart = currentBattery;

                    // Initialize counters
                    l.suggestionsShown = 0;
                    l.suggestionsAccepted = 0;
                    l.avgInteractionRating = 0;
                });
            });
        } catch (error) {
            console.error('[SeasonAnalytics] Failed to transition season:', error);
        }
    },

    /**
     * Tracks when suggestions are shown to the user.
     */
    trackSuggestionsShown: async (count: number) => {
        try {
            const openLog = await SeasonAnalyticsService.getCurrentLog();
            if (openLog) {
                await database.write(async () => {
                    await openLog.update(l => {
                        l.suggestionsShown = (l.suggestionsShown || 0) + count;
                    });
                });
            }
        } catch (error) {
            console.error('[SeasonAnalytics] Failed to track suggestions shown:', error);
        }
    },

    /**
     * Tracks when a suggestion is accepted/acted upon.
     */
    trackSuggestionAccepted: async () => {
        try {
            const openLog = await SeasonAnalyticsService.getCurrentLog();
            if (openLog) {
                await database.write(async () => {
                    await openLog.update(l => {
                        l.suggestionsAccepted = (l.suggestionsAccepted || 0) + 1;
                    });
                });
            }
        } catch (error) {
            console.error('[SeasonAnalytics] Failed to track suggestion accepted:', error);
        }
    },

    /**
     * Updates the average interaction rating for the current season.
     * Call this when a weave is completed/rated.
     */
    trackInteractionRating: async (rating: number) => {
        try {
            const openLog = await SeasonAnalyticsService.getCurrentLog();
            if (openLog) {
                await database.write(async () => {
                    await openLog.update(l => {
                        // Weighted average update
                        // We don't store total count on the log, but we can approximate or just rely on 
                        // suggestionsAccepted if we assume most ratings come from suggestions, 
                        // OR we should query the interactions table. 
                        // For simplicity/performance in this MVP, let's just store the LAST rating 
                        // or a very simple moving average if we had count.

                        // Since we didn't add a 'rating_count' column, let's use suggestionsAccepted as a proxy for count
                        // OR just simple exponential smoothing: NewAvg = OldAvg * 0.9 + NewRating * 0.1
                        const currentAvg = l.avgInteractionRating || 0;
                        if (currentAvg === 0) {
                            l.avgInteractionRating = rating;
                        } else {
                            // Simple moving average weighting
                            l.avgInteractionRating = (currentAvg * 0.8) + (rating * 0.2);
                        }
                    });
                });
            }
        } catch (error) {
            console.error('[SeasonAnalytics] Failed to track rating:', error);
        }
    },

    /**
     * Helper to get the currently active season log
     */
    getCurrentLog: async (): Promise<SocialSeasonLog | undefined> => {
        try {
            const logs = await database.get<SocialSeasonLog>('social_season_logs')
                .query(
                    // In WatermelonDB, checking for null usually requires specific syntax or raw query
                    // Let's try standard Q first. If end_date is optional/nullable.
                    Q.where('end_date', null)
                ).fetch();
            return logs[0];
        } catch (error) {
            console.warn('[SeasonAnalytics] Could not fetch current log:', error);
            return undefined;
        }
    }
};
