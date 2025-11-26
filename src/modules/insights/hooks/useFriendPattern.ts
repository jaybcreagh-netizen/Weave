import { useState, useEffect } from 'react';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { analyzeInteractionPattern, type FriendshipPattern } from '../services/pattern.service';

export function useFriendPattern(friendId: string): {
    pattern: FriendshipPattern | null;
    isLoading: boolean;
    isReliable: boolean;
} {
    const [pattern, setPattern] = useState<FriendshipPattern | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!friendId) {
            setIsLoading(false);
            return;
        }

        const loadPattern = async () => {
            try {
                setIsLoading(true);

                // Get interaction_friends records for this friend
                const interactionFriends = await database
                    .get<InteractionFriend>('interaction_friends')
                    .query(Q.where('friend_id', friendId))
                    .fetch();

                // Get interaction IDs
                const interactionIds = interactionFriends.map(
                    (ifriend) => ifriend.interactionId
                );

                if (interactionIds.length === 0) {
                    setPattern(null);
                    setIsLoading(false);
                    return;
                }

                // Query interactions (last 90 days, completed only)
                const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
                const interactions = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('id', Q.oneOf(interactionIds)),
                        Q.where('status', 'completed'),
                        Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
                        Q.sortBy('interaction_date', Q.desc)
                    )
                    .fetch();

                // Analyze pattern
                const analyzedPattern = analyzeInteractionPattern(
                    interactions.map((i) => ({
                        id: i.id,
                        interactionDate: i.interactionDate,
                        status: 'completed' as const,
                        category: i.interactionCategory,
                    }))
                );

                setPattern(analyzedPattern);
            } catch (error) {
                console.error('Error loading friend pattern:', error);
                setPattern(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadPattern();

        // Subscribe to interaction changes for this friend
        const subscription = database
            .get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId))
            .observe()
            .subscribe(() => {
                loadPattern();
            });

        return () => subscription.unsubscribe();
    }, [friendId]);

    return {
        pattern,
        isLoading,
        isReliable: pattern ? pattern.sampleSize >= 3 && pattern.consistency >= 0.6 : false,
    };
}
