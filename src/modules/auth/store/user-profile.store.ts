import { create } from 'zustand';
import { database, initializeUserProfile } from '@/db';
import UserProfile, { SocialSeason } from '@/db/models/UserProfile';
import SocialSeasonLog from '@/db/models/SocialSeasonLog';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
// Removed service imports as logic is now inline

import { Q } from '@nozbe/watermelondb';
import { Subscription } from 'rxjs';

interface UserProfileStore {
  // State
  profile: UserProfile | null;
  isLoading: boolean;
  batteryStats: {
    average: number | null;
    trend: 'rising' | 'falling' | 'stable' | null;
  };

  // Observables
  subscription: Subscription | null;
  observeProfile: () => void;
  unobserveProfile: () => void;

  // Social Season Actions
  updateSocialSeason: (season: SocialSeason) => Promise<void>;

  // Social Battery Actions
  submitBatteryCheckin: (value: number, note?: string, customTimestamp?: number) => Promise<void>;
  updateBatteryPreferences: (enabled: boolean, time?: string) => Promise<void>;
  refreshBatteryStats: () => Promise<void>;

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
  subscription: null,
  batteryStats: {
    average: null,
    trend: null,
  },

  observeProfile: () => {
    // Clean up existing subscription if any
    const existingSub = get().subscription;
    if (existingSub) {
      existingSub.unsubscribe();
    }

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
        // Refresh stats when profile loads
        get().refreshBatteryStats();
      });

    set({ subscription });
  },

  unobserveProfile: () => {
    const { subscription } = get();
    if (subscription) {
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  updateSocialSeason: async (season: SocialSeason) => {
    const { profile } = get();
    if (!profile) return;

    const now = Date.now();
    const oldSeason = profile.currentSocialSeason;

    await database.write(async () => {
      // Update user profile
      await profile.update(p => {
        p.currentSocialSeason = season;
        p.seasonLastCalculated = now;
      });

      // Update social season logs
      const logsCollection = database.get<SocialSeasonLog>('social_season_logs');

      // Close previous season if needed
      if (oldSeason && oldSeason !== season) {
        const openLogs = await logsCollection.query(
          Q.where('user_id', profile.id),
          Q.where('season', oldSeason),
          Q.where('end_date', null)
        ).fetch();

        for (const log of openLogs) {
          await log.update(l => {
            l.endDate = now;
          });
        }
      }

      // Create new log entry
      if (!oldSeason || oldSeason !== season) {
        await logsCollection.create(log => {
          log.userId = profile.id;
          log.season = season;
          log.startDate = now;
        });
      }
    });
  },

  submitBatteryCheckin: async (value: number, note?: string, customTimestamp?: number) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
      const now = Date.now();
      const timestamp = customTimestamp || now;

      await profile.update(p => {
        // Only update current battery level if adding a check-in for today
        if (!customTimestamp || timestamp >= now - 24 * 60 * 60 * 1000) {
          p.socialBatteryCurrent = value;
          p.socialBatteryLastCheckin = timestamp;
        }
      });

      // Add to battery logs
      const logsCollection = database.get<SocialBatteryLog>('social_battery_logs');
      await logsCollection.create(log => {
        log.userId = profile.id;
        log.value = value;
        log.timestamp = timestamp;
      });
    });

    // Trigger smart notification evaluation after battery check-in
    // This is a good time since user is engaged and we have fresh battery data
    try {
      const { evaluateAndScheduleSmartNotifications } = await import('@/modules/notifications');
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
    const { updateBatteryNotificationFromProfile } = await import('@/modules/notifications');
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

  refreshBatteryStats: async () => {
    const { profile } = get();
    if (!profile) return;

    try {
      const logsCollection = database.get<SocialBatteryLog>('social_battery_logs');
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days history

      const logs = await logsCollection.query(
        Q.where('user_id', profile.id),
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

      set({ batteryStats: { average, trend } });
    } catch (error) {
      console.error('Failed to refresh battery stats:', error);
    }
  },

  getRecentBatteryAverage: (days: number = 7) => {
    return get().batteryStats.average;
  },

  getBatteryTrend: () => {
    return get().batteryStats.trend;
  },
}));
