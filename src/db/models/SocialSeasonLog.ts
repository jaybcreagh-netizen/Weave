import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class SocialSeasonLog extends Model {
  static table = 'social_season_logs';

  @text('user_id') userId!: string;
  @text('season') season!: string; // 'resting' | 'flowing' | 'blooming'
  @field('start_date') startDate!: number;
  @field('end_date') endDate?: number;
}
