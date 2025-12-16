import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

export interface FriendContextData {
    friend: FriendModel;
    interactions: Interaction[];
    plannedInteractions: Interaction[];
    lastDate: number | null;
    count: number;
}

/**
 * Service responsible for efficiently fetching data for a specific set of candidate friends.
 * Replaces the "load all" pattern with targeted batch queries.
 */
export const SuggestionDataLoader = {
    /**
     * Loads full context (friend model + recent interactions) for the given friend IDs.
     */
    loadContextForCandidates: async (friendIds: string[]): Promise<Map<string, FriendContextData>> => {
        const contextMap = new Map<string, FriendContextData>();

        if (friendIds.length === 0) return contextMap;

        // 1. Fetch Friend Models
        const friends = await database.get<FriendModel>('friends')
            .query(Q.where('id', Q.oneOf(friendIds)))
            .fetch();

        // Initialize map
        friends.forEach(friend => {
            contextMap.set(friend.id, {
                friend,
                interactions: [],
                plannedInteractions: [],
                lastDate: null,
                count: 0
            });
        });

        // 2. Fetch Recent Interactions for these friends
        // Optimize: Only fetch last 5-10 interactions per friend? 
        // Hard to do "per friend limit" in one query.
        // For now, fetching recent interactions by date for the WHOLE set is better than loading ALL interactions.

        // Fetch linkage
        const links = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', Q.oneOf(friendIds)))
            .fetch();

        const interactionIds = links.map(l => l.interactionId);
        const uniqueInteractionIds = Array.from(new Set(interactionIds));

        if (uniqueInteractionIds.length > 0) {
            // Fetch actual interactions
            // We might still want to limit this if it's huge, but for 50 friends x 10 interactions = 500 records, it's fine.
            const interactions = await database.get<Interaction>('interactions')
                .query(
                    Q.where('id', Q.oneOf(uniqueInteractionIds)),
                    Q.sortBy('interaction_date', Q.desc)
                ).fetch();

            const interactionMap = new Map(interactions.map(i => [i.id, i]));

            // Distribute back to friends
            for (const link of links) {
                const interaction = interactionMap.get(link.interactionId);
                const context = contextMap.get(link.friendId);

                if (interaction && context) {
                    if (interaction.status === 'completed') {
                        context.interactions.push(interaction);
                    } else if (interaction.status === 'planned') {
                        context.plannedInteractions.push(interaction);
                    }
                }
            }

            // Post-process: Sort and Limit per friend in memory
            for (const context of contextMap.values()) {
                // Sort completed
                context.interactions.sort((a, b) => {
                    return b.interactionDate.getTime() - a.interactionDate.getTime();
                });

                context.count = context.interactions.length;
                if (context.interactions.length > 0) {
                    context.lastDate = context.interactions[0].interactionDate.getTime();
                }

                // Keep only top 5 history for suggestion context
                context.interactions = context.interactions.slice(0, 5);
            }
        }

        return contextMap;
    }
};
