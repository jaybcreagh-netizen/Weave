import { create } from 'zustand';
import { database, initializeUserProfile } from '@/db';
import UserProfile, { SocialSeason, BatteryHistoryEntry, SeasonHistoryEntry } from '@/db/models/UserProfile';
// Removed service imports as logic is now inline

interface UserProfileStore {
  // State
  profile: UserProfile | null;
  isLoading: boolean;

  // Observables
  observeProfile: () => void;

  // Social Season Actions
  updateSocialSeason: (season: SocialSeason) => Promise<void>;

  // Social Battery Actions
  submitBatteryCheckin: (value: number, note?: string, customTimestamp?: number) => Promise<void>;
  updateBatteryPreferences: (enabled: boolean, time?: string) => Promise<void>;

  // Profile Update
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;

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

  submitBatteryCheckin: async (value: number, note?: string, customTimestamp?: number) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
      await profile.update(p => {
        const now = Date.now();
        const timestamp = customTimestamp || now;

        // Only update current battery level if adding a check-in for today
        if (!customTimestamp || timestamp >= now - 24 * 60 * 60 * 1000) {
          p.socialBatteryCurrent = value;
          p.socialBatteryLastCheckin = timestamp;
        }

        // Add to battery history
        const history: BatteryHistoryEntry[] = profile.socialBatteryHistory || [];

        // Check if there's already a check-in for this date (same calendar day)
        const targetDate = new Date(timestamp);
        targetDate.setHours(0, 0, 0, 0);
        const targetDayStart = targetDate.getTime();
        const targetDayEnd = targetDayStart + 24 * 60 * 60 * 1000;

        // Remove any existing check-in for this day
        const filteredHistory = history.filter(entry => {
          return entry.timestamp < targetDayStart || entry.timestamp >= targetDayEnd;
        });

        // Add new check-in
        filteredHistory.push({
          value,
          timestamp,
          note,
        });

        // Sort by timestamp
        filteredHistory.sort((a, b) => a.timestamp - b.timestamp);

        // Keep only last 90 days of history (for performance)
        const cutoff = now - 90 * 24 * 60 * 60 * 1000;
        const recentHistory = filteredHistory.filter(entry => entry.timestamp >= cutoff);

        p.socialBatteryHistoryRaw = JSON.stringify(recentHistory);
      });
    });

    // Trigger smart notification evaluation after battery check-in
    // This is a good time since user is engaged and we have fresh battery data
    try {
      const { evaluateAndScheduleSmartNotifications } = await import('@/lib/smart-notification-scheduler');
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
    const { updateBatteryNotificationFromProfile } = await import('@/lib/notification-manager-enhanced');
    await updateBatteryNotificationFromProfile();
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
      await profile.update(p => {
        Object.assign(p, updates);
      });
    });
  },

  getSocialSeason: () => {
    const { profile } = get();
    return profile?.currentSocialSeason || null;
  },

  getRecentBatteryAverage: (days: number = 7) => {
    const { profile } = get();
    if (!profile) return null;
    // Calculate locally since the service function was removed/refactored
    const history = profile.socialBatteryHistory;
    if (!history || history.length === 0) return null;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentEntries = history.filter(e => e.timestamp >= cutoff);

    if (recentEntries.length === 0) return null;
    const sum = recentEntries.reduce((acc, e) => acc + e.value, 0);
    return sum / recentEntries.length;
  },

  getBatteryTrend: () => {
    const { profile } = get();
    if (!profile) return null;
    // Calculate locally - restore original moving average logic
    const history = profile.socialBatteryHistory;
    if (!history || history.length < 6) return 'stable'; // Need enough data for 3-day comparison

    // Get last 3 entries and previous 3 entries
    const recent = history.slice(-6);
    const currentWindow = recent.slice(-3);
    const previousWindow = recent.slice(0, 3);

    const currentAvg = currentWindow.reduce((sum, e) => sum + e.value, 0) / 3;
    const previousAvg = previousWindow.reduce((sum, e) => sum + e.value, 0) / 3;

    if (currentAvg > previousAvg + 0.5) return 'rising';
    if (currentAvg < previousAvg - 0.5) return 'falling';
    return 'stable';
  },
}));
