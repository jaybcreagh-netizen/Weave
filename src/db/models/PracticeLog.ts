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

}
