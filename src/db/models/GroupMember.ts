import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import Group from './Group';
import Friend from './Friend';

import { Associations } from '@nozbe/watermelondb/Model';

export default class GroupMember extends Model {
    static table = 'group_members';

    static associations: Associations = {
        groups: { type: 'belongs_to', key: 'group_id' },
        friends: { type: 'belongs_to', key: 'friend_id' },
    };

    @field('group_id') groupId!: string;
    @field('friend_id') friendId!: string;

    @relation('groups', 'group_id') group!: Relation<Group>;
    @relation('friends', 'friend_id') friend!: Relation<Friend>;
}
