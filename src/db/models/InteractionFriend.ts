import { Model } from '@nozbe/watermelondb';
import { relation, field, text } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class InteractionFriend extends Model {
  static table = 'interaction_friends';

  static associations: Associations = {
    interactions: { type: 'belongs_to', key: 'interaction_id' },
    friends: { type: 'belongs_to', key: 'friend_id' }
  }

  @field('interaction_id') interactionId!: string;
  @field('friend_id') friendId!: string;

  @relation('interactions', 'interaction_id') interaction!: any;
  @relation('friends', 'friend_id') friend!: any;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') customSyncStatus?: string;
}
