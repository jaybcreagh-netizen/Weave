import { Model } from '@nozbe/watermelondb';
import { field, date, children, readonly } from '@nozbe/watermelondb/decorators';

export default class Group extends Model {
    static table = 'groups';

    static associations: any = {
        group_members: { type: 'has_many', foreignKey: 'group_id' },
    };

    @field('name') name!: string;
    @field('type') type!: 'manual' | 'smart';
    @field('smart_confidence') smartConfidence?: number;

    @children('group_members') members!: any;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;
}
