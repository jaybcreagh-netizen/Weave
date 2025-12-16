import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { SocialSeason } from '@/db/models/UserProfile';
import { SeasonAnalyticsService } from '@/modules/intelligence';

export const SocialSeasonService = {
    /**
     * Updates the user's social season and logs the transition.
     */
    async updateSeason(userId: string, season: SocialSeason, durationDays?: number): Promise<void> {
        const profileCollection = database.get<UserProfile>('user_profile');
        const profile = await profileCollection.find(userId);

        if (!profile) return;

        const now = Date.now();
        const oldSeason = profile.currentSocialSeason;

        await database.write(async () => {
            await profile.update(p => {
                p.currentSocialSeason = season;
                p.seasonLastCalculated = now;

                if (durationDays) {
                    const expiry = now + (durationDays * 24 * 60 * 60 * 1000);
                    p.seasonOverrideUntil = expiry;
                    p.seasonOverrideReason = 'manual_override';
                } else {
                    // Clear override if no duration provided (means auto-calculated)
                    p.seasonOverrideUntil = undefined;
                    p.seasonOverrideReason = undefined;
                }
            });
        });

        // Log the season transition with analytics
        if (!oldSeason || oldSeason !== season) {
            await SeasonAnalyticsService.transitionSeason(season, !!durationDays);
        }
    }
};
