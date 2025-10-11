import { Model } from '@nozbe/watermelondb';
import { relation } from '@nozbe/watermelondb/decorators';

export default class InteractionFriend extends Model {
    static table = 'interaction_friends';

    @relation('interactions', 'interaction_id') interaction;
    @relation('friends', 'friend_id') friend;
}