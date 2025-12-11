import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { calculateSocialSeason } from './season-calculator';
// We might need to trigger a full recalculation which depends on stats.
// A simpler approach is to just clear the override and let the widget/app flow handle recalculation on next load, 
// OR we can explicitly call the update store action if available, but we are in a service layer here.

export const SeasonManager = {
    /**
     * Checks if the active season override has expired.
     * If expired, it clears the override fields in the database.
     * Returns true if an override was cleared, false otherwise.
     */
    checkSeasonOverrideExpiry: async (): Promise<boolean> => {
        try {
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const profile = profiles[0];

            if (!profile) return false;
            if (!profile.seasonOverrideUntil) return false;

            const now = Date.now();
            if (profile.seasonOverrideUntil <= now) {
                // Override expired
                await database.write(async () => {
                    await profile.update(p => {
                        p.seasonOverrideUntil = undefined;
                        p.seasonOverrideReason = undefined;
                        // We reset seasonLastCalculated to 0 to force a strict recalculation next time the widget loads
                        p.seasonLastCalculated = 0;
                    });
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error('[SeasonManager] Error checking override expiry:', error);
            return false;
        }
    }
};
