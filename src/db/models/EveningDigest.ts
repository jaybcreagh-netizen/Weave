import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export interface DigestItem {
    id: string;
    type: 'interaction' | 'suggestion' | 'insight' | 'plan' | 'confirmation' | 'birthday' | 'anniversary' | 'life_event' | 'memory';
    priority: number;
    title: string;
    description?: string;
    data?: Record<string, any>;
}

export default class EveningDigest extends Model {
    static table = 'evening_digests';

    @field('digest_date') digestDate!: number;
    @field('items_json') itemsJson!: string;
    @field('notification_title') notificationTitle!: string;
    @field('notification_body') notificationBody!: string;
    @field('item_count') itemCount!: number;
    @readonly @date('created_at') createdAt!: Date;

    // Helper to parse the JSON items
    get items(): DigestItem[] {
        try {
            return JSON.parse(this.itemsJson);
        } catch {
            return [];
        }
    }
}
