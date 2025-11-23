import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class SocialBatteryLog extends Model {
  static table = 'social_battery_logs';

  @text('user_id') userId!: string;
  @field('value') value!: number;
  @field('timestamp') timestamp!: number;
}
