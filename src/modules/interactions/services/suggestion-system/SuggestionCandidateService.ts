import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import Interaction from '@/db/models/Interaction';

export interface CandidateResult {
    friendIds: string[];
    priority: 'critical' | 'high' | 'normal';
}

/**
 * Service responsible for identifying WHICH friends need suggestion processing.
 * Uses optimized SQL queries to select a candidate pool instead of loading all friends.
 */
export const SuggestionCandidateService = {
    /**
     * Get a prioritized list of friends to generate suggestions for.
     * Limits the total number of candidates to prevent performance issues.
     */
    getCandidates: async (limit: number = 50): Promise<string[]> => {
        const candidateIds = new Set<string>();

        // 1. Critical/High Priority: Friends with upcoming plans or specific dates
        // We actually might want to rely on the general generator for this, 
        // BUT to optimize, we should ensure these friends are definitely included.
        // For now, let's focus on the biggest volume driver: DRIFT and MAINTENANCE.

        // 2. Drifting Friends (Low Score)
        // Fetch up to limit/2 friends who are drifting (score < 50)
        const driftingFriends = await database.get<FriendModel>('friends')
            .query(
                Q.where('weave_score', Q.lt(50)),
                Q.sortBy('weave_score', Q.asc), // Lowest score first
                Q.take(Math.floor(limit / 2))
            ).fetch();

        driftingFriends.forEach(f => candidateIds.add(f.id));

        // 3. Recent Interactions (Active Friends) - Query LINKS directly
        // This is more robust than relying on Friend.last_updated
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentInteractionFriends = await database.get<InteractionFriend>('interaction_friends')
            .query(
                Q.on('interactions', 'interaction_date', Q.gte(oneWeekAgo)),
                Q.take(limit) // Take more to account for duplicates, we dedupe below
            ).fetch();

        recentInteractionFriends.forEach(link => candidateIds.add(link.friendId));

        // 4. Fill the rest with random/general friends ensuring we cycle through everyone eventually
        // Since random sort is hard in WM, we might just query by 'updated_at' asc (stale records)
        if (candidateIds.size < limit) {
            const remainingSlots = limit - candidateIds.size;
            const staleFriends = await database.get<FriendModel>('friends')
                .query(
                    Q.sortBy('last_updated', Q.asc), // Least recently updated/touched
                    Q.take(remainingSlots)
                ).fetch();

            staleFriends.forEach(f => candidateIds.add(f.id));
        }

        return Array.from(candidateIds);
    }
};
