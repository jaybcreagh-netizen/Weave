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

  // Identity (v49)
  @text('phone') phone?: string;
  @text('email') email?: string;
  @text('google_id') googleId?: string;

  // v53: AI Privacy Settings
  @field('ai_features_enabled') aiFeaturesEnabled?: boolean; // Master toggle
  @field('ai_journal_analysis_enabled') aiJournalAnalysisEnabled?: boolean; // Journal signal extraction
  @field('ai_oracle_enabled') aiOracleEnabled?: boolean; // Oracle consultations
  @field('ai_disclosure_acknowledged_at') aiDisclosureAcknowledgedAt?: number; // When user read disclosure

  /** Check if AI features are available (master toggle on + disclosure acknowledged) */
  get isAIEnabled(): boolean {
    return this.aiFeaturesEnabled === true && this.aiDisclosureAcknowledgedAt !== undefined;
  }

  /** Check if journal analysis specifically is enabled */
  get isJournalAnalysisEnabled(): boolean {
    return this.isAIEnabled && this.aiJournalAnalysisEnabled !== false;
  }

  /** Check if Oracle is enabled */
  get isOracleEnabled(): boolean {
    return this.isAIEnabled && this.aiOracleEnabled !== false;
  }

  // v54: Proactive Insights (Phase 7)
  @field('proactive_insights_enabled') proactiveInsightsEnabled?: boolean;
  @text('suppressed_insight_rules') suppressedInsightRules?: string; // JSON array of rule IDs

  // v57: Oracle Tone Preference (Phase 4 Style Personalization)
  @text('oracle_tone_preference') oracleTonePreference?: 'grounded' | 'warm' | 'playful' | 'poetic';

  // v58: Oracle Insight Frequency (Phase 1 Redesign)
  @text('insight_frequency') insightFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'on_demand';
}
