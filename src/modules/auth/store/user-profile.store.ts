import { create } from 'zustand';
import { database, initializeUserProfile } from '@/db';
import UserProfile, { SocialSeason } from '@/db/models/UserProfile';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import { SeasonAnalyticsService } from '@/modules/intelligence/services/social-season/season-analytics.service';
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
  updateSocialSeason: (season: SocialSeason, durationDays?: number) => Promise<void>;

  // Social Battery Actions
  submitBatteryCheckin: (value: number, note?: string, customTimestamp?: number, overwriteDay?: boolean) => Promise<void>;
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

  updateSocialSeason: async (season: SocialSeason, durationDays?: number) => {
    const { profile } = get();
    if (!profile) return;

    const now = Date.now();
    const oldSeason = profile.currentSocialSeason;

    await database.write(async () => {
      // Update user profile
      // Update user profile
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
    // We do this outside the main write block to avoid nested transactions
    if (!oldSeason || oldSeason !== season) {
      await SeasonAnalyticsService.transitionSeason(season, !!durationDays);
    }
  },

  submitBatteryCheckin: async (value: number, note?: string, customTimestamp?: number, overwriteDay?: boolean) => {
    const { profile } = get();
    if (!profile) return;

    await database.write(async () => {
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
          await log.markAsDeleted(); // or log.destroyPermanently() if you prefer hard delete
        }
      }

      await profile.update(p => {
        // Only update current battery level if adding a check-in for today
        // OR if we are overwriting a past day, we might NOT want to update "current" unless it IS today.
        // The original logic was: if (!customTimestamp || timestamp >= now - 24h)
        // Let's keep that logic to avoid setting "current battery" to a value from 3 months ago.
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
      const { SmartSuggestionsChannel, BatteryCheckinChannel } = await import('@/modules/notifications');

      // 1. Reschedule "Social Battery" notification (Safety Net)
      // Since user just checked in, we silence today's reminder and schedule for tomorrow.
      await BatteryCheckinChannel.rescheduleForTomorrow();

      // 2. Evaluate other smart notifications
      await SmartSuggestionsChannel.evaluateAndSchedule();
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
    const { BatteryCheckinChannel } = await import('@/modules/notifications');
    if (enabled) {
      await BatteryCheckinChannel.schedule();
    } else {
      await BatteryCheckinChannel.cancel();
    }
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
