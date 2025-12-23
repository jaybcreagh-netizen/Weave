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

        // Quota Configuration
        // user requested: 20 drifting, 15 active, 15 reserved for stale
        const DRIFT_LIMIT = 20;
        const ACTIVE_LIMIT = 15;
        // Stale limit is implicitly "the rest", but we must ensure we reserve space for it.
        // We do this by strictly capping the others.

        // 1. Drifting Friends (Low Score)
        // Strict cap at DRIFT_LIMIT
        // 1. Drifting Friends (Low Score)
        // Strict cap at DRIFT_LIMIT
        // Tier-aware drifting:
        // InnerCircle < 50
        // CloseFriends < 30
        // Community < 20
        // We fetch candidates with score < 50 (max threshold) and filter in memory for precision
        const potentialDrifters = await database.get<FriendModel>('friends')
            .query(
                Q.where('weave_score', Q.lt(50)),
                Q.sortBy('weave_score', Q.asc), // Lowest score first
                Q.take(50) // Fetch more than limit to allow for filtering
            ).fetch();

        const driftingFriends = potentialDrifters.filter(f => {
            const tier = (f.dunbarTier || 'Community') as keyof typeof threshold;
            const threshold = {
                InnerCircle: 50,
                CloseFriends: 30,
                Community: 20
            };
            return f.weaveScore < (threshold[tier] || 20);
        }).slice(0, DRIFT_LIMIT);



        driftingFriends.forEach(f => candidateIds.add(f.id));

        // 2. Recent Interactions (Active Friends)
        // Strict cap at ACTIVE_LIMIT, but we must be careful with duplicates from step 1.
        // We fetch more to account for overlap, but stop adding once we hit the quota or run out.
        // NOTE: Using manual two-step query to avoid Q.on issues on physical devices (per project memory)
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        // Step A: Get recent interaction IDs
        const recentInteractions = await database.get<Interaction>('interactions')
            .query(
                Q.where('interaction_date', Q.gte(oneWeekAgo)),
                Q.where('status', 'completed'),
                Q.sortBy('interaction_date', Q.desc),
                Q.take(200) // Fetch more to cover multiple friends
            ).fetch();

        const recentInteractionIds = recentInteractions.map(i => i.id);

        // Step B: Get friend links for those interactions
        let recentInteractionFriends: InteractionFriend[] = [];
        if (recentInteractionIds.length > 0) {
            recentInteractionFriends = await database.get<InteractionFriend>('interaction_friends')
                .query(Q.where('interaction_id', Q.oneOf(recentInteractionIds)))
                .fetch();
        }

        let activeAddedCount = 0;
        for (const link of recentInteractionFriends) {
            if (activeAddedCount >= ACTIVE_LIMIT) break;

            if (!candidateIds.has(link.friendId)) {
                candidateIds.add(link.friendId);
                activeAddedCount++;
            }
        }

        // 3. Fill the rest with Stale/Middle friends
        // This effectively reserves (limit - current_count) slots.
        // If drift used 20 and active used 15, we have 15 left for Stale.
        // If drift used 5 and active used 15, we have 30 left for Stale.
        // This guarantees Stale gets exposure.
        if (candidateIds.size < limit) {
            const remainingSlots = limit - candidateIds.size;

            // We fetch significantly more than needed because the "Stale" query might return users
            // we ALREADY picked up in the Active/Drifting steps (if they haven't been updated recently).
            // This ensures we dig deep enough to find actual NEW candidates.
            const staleFriends = await database.get<FriendModel>('friends')
                .query(
                    Q.sortBy('last_updated', Q.asc), // Least recently updated/touched
                    Q.take(Math.max(remainingSlots * 3, 50))
                ).fetch();

            let staleAdded = 0;
            for (const f of staleFriends) {
                if (staleAdded >= remainingSlots) break;

                if (!candidateIds.has(f.id)) {
                    candidateIds.add(f.id);
                    staleAdded++;
                }
            }
        }

        return Array.from(candidateIds);
    }
};
