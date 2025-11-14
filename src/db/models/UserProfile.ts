import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export type SocialSeason = 'resting' | 'balanced' | 'blooming';

export interface SeasonHistoryEntry {
  season: SocialSeason;
  startDate: number;
  endDate?: number;
}

export interface BatteryHistoryEntry {
  value: number; // 1-5
  timestamp: number;
  note?: string;
}

export default class UserProfile extends Model {
  static table = 'user_profile';

  // Social Season State
  @text('current_social_season') currentSocialSeason?: SocialSeason;
  @field('season_last_calculated') seasonLastCalculated?: number;
  @text('season_history') seasonHistoryRaw?: string; // JSON string

  // Social Battery
  @field('social_battery_current') socialBatteryCurrent?: number; // 1-5
  @field('social_battery_last_checkin') socialBatteryLastCheckin?: number;
  @text('social_battery_history') socialBatteryHistoryRaw?: string; // JSON string

  // Preferences
  @field('battery_checkin_enabled') batteryCheckinEnabled?: boolean;
  @text('battery_checkin_time') batteryCheckinTime?: string; // HH:mm format

  // Weekly Reflection Preferences
  @field('reflection_day') reflectionDay?: number; // 0-6 (0=Sunday, 1=Monday, etc.)
  @field('reflection_auto_show') reflectionAutoShow?: boolean; // Auto-show prompt on reflection day
  @field('reflection_last_snoozed') reflectionLastSnoozed?: number; // Timestamp when user last snoozed

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Computed properties for JSON parsing
  get seasonHistory(): SeasonHistoryEntry[] {
    if (!this.seasonHistoryRaw) return [];
    try {
      return JSON.parse(this.seasonHistoryRaw);
    } catch {
      return [];
    }
  }

  get socialBatteryHistory(): BatteryHistoryEntry[] {
    if (!this.socialBatteryHistoryRaw) return [];
    try {
      return JSON.parse(this.socialBatteryHistoryRaw);
    } catch {
      return [];
    }
  }

  // Helper to get recent battery average
  getRecentBatteryAverage(days: number = 7): number | null {
    const history = this.socialBatteryHistory;
    if (history.length === 0) return null;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentEntries = history.filter(entry => entry.timestamp >= cutoff);

    if (recentEntries.length === 0) return null;

    const sum = recentEntries.reduce((acc, entry) => acc + entry.value, 0);
    return sum / recentEntries.length;
  }

  // Helper to get battery trend
  getBatteryTrend(): 'rising' | 'falling' | 'stable' | null {
    const history = this.socialBatteryHistory;
    if (history.length < 3) return null;

    // Compare recent 3 vs previous 3
    const recent = history.slice(-3);
    const previous = history.slice(-6, -3);

    if (previous.length < 3) return null;

    const recentAvg = recent.reduce((sum, e) => sum + e.value, 0) / recent.length;
    const prevAvg = previous.reduce((sum, e) => sum + e.value, 0) / previous.length;

    const diff = recentAvg - prevAvg;

    if (diff > 0.5) return 'rising';
    if (diff < -0.5) return 'falling';
    return 'stable';
  }
}
