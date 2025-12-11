import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class SocialSeasonLog extends Model {
  static table = 'social_season_logs';

  @text('user_id') userId!: string;
  @text('season') season!: string; // 'resting' | 'flowing' | 'blooming'
  @field('start_date') startDate!: number;
  @field('end_date') endDate?: number;

  // Analytics Fields
  @field('manual_override') manualOverride!: boolean;
  @field('battery_start') batteryStart!: number;
  @field('battery_end') batteryEnd?: number;
  @field('suggestions_shown') suggestionsShown!: number;
  @field('suggestions_accepted') suggestionsAccepted!: number;
  @field('avg_interaction_rating') avgInteractionRating!: number;
}
