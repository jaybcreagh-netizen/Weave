import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q, Query } from '@nozbe/watermelondb';

export class FriendRepository {
    private collection = database.get<Friend>('friends');

    async getAllFriends(): Promise<Friend[]> {
        return this.collection.query().fetch();
    }

    async getFriendById(id: string): Promise<Friend | undefined> {
        try {
            return await this.collection.find(id);
        } catch (error) {
            return undefined;
        }
    }

    async getAllFriendsWithLastInteraction(): Promise<Friend[]> {
        // This is a placeholder for the optimized query. 
        // In a real implementation, we might use unsafeSql or a raw query 
        // to join with interactions and get the latest one to avoid N+1.
        // For now, we'll return all friends and let the caller handle it, 
        // or we can implement the optimization here later.
        return this.collection.query().fetch();
    }

    async createFriend(data: Partial<Friend>): Promise<Friend> {
        return await database.write(async () => {
            return await this.collection.create(friend => {
                Object.assign(friend, data);
            });
        });
    }

    async updateFriend(id: string, data: Partial<Friend>): Promise<Friend> {
        const friend = await this.getFriendById(id);
        if (!friend) throw new Error('Friend not found');

        return await database.write(async () => {
            return await friend.update(f => {
                Object.assign(f, data);
            });
        });
    }

    // Add more specialized queries here as needed
    async getFriendsByTier(tier: string): Promise<Friend[]> {
        return this.collection.query(Q.where('dunbar_tier', tier)).fetch();
    }

    getFriendsByTierQuery(tier: string): Query<Friend> {
        return this.collection.query(
            Q.where('dunbar_tier', tier),
            Q.sortBy('weave_score', Q.asc)
        );
    }
}

export const friendRepository = new FriendRepository();
