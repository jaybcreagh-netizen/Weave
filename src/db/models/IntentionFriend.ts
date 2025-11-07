import { Model } from '@nozbe/watermelondb';
import { relation, field } from '@nozbe/watermelondb/decorators';

export default class IntentionFriend extends Model {
  static table = 'intention_friends';

  static associations = {
    intentions: { type: 'belongs_to', key: 'intention_id' },
    friends: { type: 'belongs_to', key: 'friend_id' },
  };

  @field('intention_id') intentionId!: string;
  @field('friend_id') friendId!: string;

  @relation('intentions', 'intention_id') intention!: any;
  @relation('friends', 'friend_id') friend!: any;
}
