import { Model } from '@nozbe/watermelondb';
import { relation, field } from '@nozbe/watermelondb/decorators';
import Intention from './Intention';
import FriendModel from './Friend';

export default class IntentionFriend extends Model {
  static table = 'intention_friends';

  static associations = {
    intentions: { type: 'belongs_to', key: 'intention_id' },
    friends: { type: 'belongs_to', key: 'friend_id' },
  };

  @field('intention_id') intentionId!: string;
  @field('friend_id') friendId!: string;

  @relation('intentions', 'intention_id') intention!: Intention;
  @relation('friends', 'friend_id') friend!: FriendModel;
}
