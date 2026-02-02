import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

export default class NarrativeMoment extends Model {
    static table = 'narrative_moments';

    @field('friend_id') friendId!: string;
    @text('moment_type') momentType!: string;
    @date('occurred_at') occurredAt!: Date;
    @text('user_reflection') userReflection!: string;
    @text('context_json') contextJson!: string;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;

    get context() {
        try {
            return this.contextJson ? JSON.parse(this.contextJson) : null;
        } catch {
            return null;
        }
    }
}
