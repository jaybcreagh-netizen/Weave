import { create } from 'zustand';
import { database, initializeUserProfile } from '../db';
import UserProfile, { SocialSeason, BatteryHistoryEntry, SeasonHistoryEntry } from '../db/models/UserProfile';

interface UserProfileStore {
  // State
  profile: UserProfile | null;
  isLoading: boolean;

  // Observables
  observeProfile: () => void;

  // Social Season Actions
  updateSocialSeason: (season: SocialSeason) => Promise<void>;

  // Social Battery Actions
  submitBatteryCheckin: (value: number, note?: string) => Promise<void>;
  updateBatteryPreferences: (enabled: boolean, time?: string) => Promise<void>;

  // Getters
  getSocialSeason: () => SocialSeason | null;
  getRecentBatteryAverage: (days?: number) => number | null;
  getBatteryTrend: () => 'rising' | 'falling' | 'stable' | null;
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: null,
  isLoading: true,

  observeProfile: () => {
    // Initialize profile if it doesn't exist
    initializeUserProfile();

    // Subscribe to the user profile observable
    const subscription = database
      .get<UserProfile>('user_profile')
      .query()
      .observe()
      .subscribe(profiles => {
        set({
          profile: profiles[0] || null,
          isLoading: false
        });
      });

    // Return cleanup function (though Zustand doesn't use it directly)
    return () => subscription.unsubscribe();
  },

  updateSocialSeason: async (season: SocialSeason) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
      await profile.update(p => {
        const now = Date.now();

        // Update current season
        const oldSeason = p.currentSocialSeason;
        p.currentSocialSeason = season;
        p.seasonLastCalculated = now;

        // Update season history
        const history: SeasonHistoryEntry[] = profile.seasonHistory || [];

        // Close previous season if it exists and is different
        if (oldSeason && oldSeason !== season && history.length > 0) {
          const lastEntry = history[history.length - 1];
          if (!lastEntry.endDate) {
            lastEntry.endDate = now;
          }
        }

        // Add new season entry if it's different from the last one
        if (!oldSeason || oldSeason !== season) {
          history.push({
            season,
            startDate: now,
          });
        }

        p.seasonHistoryRaw = JSON.stringify(history);
      });
    });
  },

  submitBatteryCheckin: async (value: number, note?: string) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
      await profile.update(p => {
        const now = Date.now();

        // Update current battery level
        p.socialBatteryCurrent = value;
        p.socialBatteryLastCheckin = now;

        // Add to battery history
        const history: BatteryHistoryEntry[] = profile.socialBatteryHistory || [];
        history.push({
          value,
          timestamp: now,
          note,
        });

        // Keep only last 90 days of history (for performance)
        const cutoff = now - 90 * 24 * 60 * 60 * 1000;
        const recentHistory = history.filter(entry => entry.timestamp >= cutoff);

        p.socialBatteryHistoryRaw = JSON.stringify(recentHistory);
      });
    });

    // Trigger smart notification evaluation after battery check-in
    // This is a good time since user is engaged and we have fresh battery data
    try {
      const { evaluateAndScheduleSmartNotifications } = await import('../lib/smart-notification-scheduler');
      await evaluateAndScheduleSmartNotifications();
    } catch (error) {
      console.error('Error evaluating smart notifications after battery check-in:', error);
    }
  },

  updateBatteryPreferences: async (enabled: boolean, time?: string) => {
    const { profile } = get();
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
    const { updateBatteryNotificationFromProfile } = await import('../lib/notification-manager-enhanced');
    await updateBatteryNotificationFromProfile();
  },

  getSocialSeason: () => {
    const { profile } = get();
    return profile?.currentSocialSeason || null;
  },

  getRecentBatteryAverage: (days: number = 7) => {
    const { profile } = get();
    return profile?.getRecentBatteryAverage(days) || null;
  },

  getBatteryTrend: () => {
    const { profile } = get();
    return profile?.getBatteryTrend() || null;
  },
}));
