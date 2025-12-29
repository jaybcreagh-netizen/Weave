import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

export default class PendingPushNotification extends Model {
    static table = 'pending_push_notifications';

    @text('recipient_user_id') recipientUserId!: string;
    @text('payload') payload!: string;
    @field('retry_count') retryCount!: number;
    @readonly @date('created_at') createdAt!: Date;
}
