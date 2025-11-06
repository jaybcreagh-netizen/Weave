import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import FriendModel from './Friend';

export default class Intention extends Model {
  static table = 'intentions';

  static associations = {
    intention_friends: { type: 'has_many', foreignKey: 'intention_id' },
  };


  // Flexible description - can be vague or specific
  @text('description') description?: string;

  // Optional category if they have specific activity in mind
  @field('interaction_category') interactionCategory?: string;

  // Status tracking
  @field('status') status!: 'active' | 'converted' | 'dismissed';

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Track when last reminded (for suggestion engine)
  @date('last_reminded_at') lastRemindedAt?: Date;
}
