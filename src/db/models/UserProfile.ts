import { Model } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
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
  static associations: Associations = {};

  // Social Season State
  @text('current_social_season') currentSocialSeason?: SocialSeason;
  @field('season_last_calculated') seasonLastCalculated?: number;
  // NEW v41: Season Override (Phase 3)
  @field('season_override_until') seasonOverrideUntil?: number;
  @field('season_override_reason') seasonOverrideReason?: string;

  // Social Battery
  @field('social_battery_current') socialBatteryCurrent?: number; // 1-5
  @field('social_battery_last_checkin') socialBatteryLastCheckin?: number;

  // Preferences
  @field('battery_checkin_enabled') batteryCheckinEnabled?: boolean;
  @text('battery_checkin_time') batteryCheckinTime?: string; // HH:mm format

  // Weekly Reflection Preferences
  @field('reflection_day') reflectionDay?: number; // 0-6 (0=Sunday, 1=Monday, etc.)
  @field('reflection_auto_show') reflectionAutoShow?: boolean; // Auto-show prompt on reflection day
  @field('reflection_last_snoozed') reflectionLastSnoozed?: number; // Timestamp when user last snoozed

  // Tier Intelligence Settings (v36)
  @text('tier_flexibility_mode') tierFlexibilityMode?: 'strict' | 'balanced' | 'flexible'; // How much decay adapts
  @field('tier_intelligence_enabled') tierIntelligenceEnabled?: boolean; // Show tier fit indicators

  // Messaging preferences (v47)
  @text('default_messaging_app') defaultMessagingApp?: 'whatsapp' | 'telegram' | 'sms' | 'email';

  @text('social_battery_history') socialBatteryHistoryJSON?: string;

  get socialBatteryHistory(): BatteryHistoryEntry[] {
    if (!this.socialBatteryHistoryJSON) return [];
    try {
      return JSON.parse(this.socialBatteryHistoryJSON);
    } catch {
      return [];
    }
  }

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') customSyncStatus?: string;
  @field('server_updated_at') serverUpdatedAt?: number;
}
