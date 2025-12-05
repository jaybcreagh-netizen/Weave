import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class NetworkHealthLog extends Model {
    static table = 'network_health_logs';

    @field('score') score!: number;
    @date('timestamp') timestamp!: Date;
    @readonly @date('created_at') createdAt!: Date;
}
