import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export type PracticeType =
  | 'log_weave'
  | 'add_reflection'
  | 'create_intention'
  | 'plan_weave'
  | 'view_reading';

export default class PracticeLog extends Model {
  static table = 'practice_log';

  @field('practice_date') practiceDate!: number; // Timestamp truncated to day start
  @text('practice_type') practiceType!: PracticeType;
  @text('related_id') relatedId?: string; // Reference to interaction/intention/etc

  @readonly @date('created_at') createdAt!: Date;

  // Helper to truncate timestamp to day start (for grouping)
  static truncateToDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  // Helper to check if practice was today
  isToday(): boolean {
    const today = PracticeLog.truncateToDay(Date.now());
    return this.practiceDate === today;
  }

  // Helper to get day difference from today
  daysAgo(): number {
    const today = PracticeLog.truncateToDay(Date.now());
    const daysDiff = Math.floor((today - this.practiceDate) / (24 * 60 * 60 * 1000));
    return daysDiff;
  }
}
