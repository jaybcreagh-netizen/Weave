import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import Group from './Group';
import Friend from './Friend';

export default class GroupMember extends Model {
    static table = 'group_members';

    static associations: any = {
        groups: { type: 'belongs_to', key: 'group_id' },
        friends: { type: 'belongs_to', key: 'friend_id' },
    };

    @field('group_id') groupId!: string;
    @field('friend_id') friendId!: string;

    @relation('groups', 'group_id') group!: Group;
    @relation('friends', 'friend_id') friend!: Friend;
}
