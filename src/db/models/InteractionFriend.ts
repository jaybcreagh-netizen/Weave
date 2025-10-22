import { Model } from '@nozbe/watermelondb';
import { relation, field } from '@nozbe/watermelondb/decorators';

export default class InteractionFriend extends Model {
    static table = 'interaction_friends';
    
    static associations = {
      interactions: { type: 'belongs_to', key: 'interaction_id' },
      friends: { type: 'belongs_to', key: 'friend_id' }
    }

    @field('interaction_id') interactionId!: string;
    @field('friend_id') friendId!: string;

    @relation('interactions', 'interaction_id') interaction;
    @relation('friends', 'friend_id') friend;
}
