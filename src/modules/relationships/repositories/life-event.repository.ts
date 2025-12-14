import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';

export const LifeEventRepository = {
    async getActiveEventsForFriend(friendId: string): Promise<LifeEvent[]> {
        const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
        return await database
            .get<LifeEvent>('life_events')
            .query(
                Q.where('friend_id', friendId),
                Q.or(
                    Q.where('event_date', Q.gte(sixtyDaysAgo)),
                    Q.where('event_date', Q.gt(Date.now()))
                ),
                Q.sortBy('event_date', 'asc')
            )
            .fetch();
    }
};
