import { useState, useEffect } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import ConversationThread from '@/db/models/ConversationThread';
import { logger } from '@/shared/services/logger.service';

export function useActiveThreads(friendIds: string[]) {
    const [threads, setThreads] = useState<ConversationThread[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (friendIds.length === 0) {
            setThreads([]);
            return;
        }

        const fetchThreads = async () => {
            setIsLoading(true);
            try {
                const results = await database.get<ConversationThread>('conversation_threads')
                    .query(
                        Q.where('friend_id', Q.oneOf(friendIds)),
                        Q.where('status', 'active'),
                        Q.sortBy('last_mentioned', Q.desc)
                    )
                    .fetch();

                // Group by friend and limit to 3 per friend
                const threadsByFriend: Record<string, ConversationThread[]> = {};
                results.forEach(t => {
                    if (!threadsByFriend[t.friendId]) threadsByFriend[t.friendId] = [];
                    if (threadsByFriend[t.friendId].length < 3) {
                        threadsByFriend[t.friendId].push(t);
                    }
                });

                // Flatten back to array
                const limitedThreads = Object.values(threadsByFriend).flat();
                setThreads(limitedThreads);
            } catch (error) {
                logger.error('useActiveThreads', 'Error fetching threads:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchThreads();
    }, [friendIds.join(',')]); // Re-run when friend IDs change

    return { threads, isLoading };
}
