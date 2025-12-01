import { Model, Relation } from '@nozbe/watermelondb';
import { relation, field, text } from '@nozbe/watermelondb/decorators';
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

  @relation('intentions', 'intention_id') intention!: Relation<Intention>;
  @relation('friends', 'friend_id') friend!: Relation<FriendModel>;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') syncStatus?: string;
}
