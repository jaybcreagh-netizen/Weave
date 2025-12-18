import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { fetchSuggestions } from './suggestion-provider.service';
import { SuggestionCandidateService } from './suggestion-system/SuggestionCandidateService';
import * as SuggestionStorageService from './suggestion-storage.service';
import { calculateCurrentScore } from '@/modules/intelligence';

export const SuggestionDebugService = {
    async runDiagnostics() {
        try {
            const friendsCount = await database.get('friends').query().fetchCount();
            const interactionsCount = await database.get('interactions').query().fetchCount();

            // diagnostic candidates
            const candidates = await SuggestionCandidateService.getCandidates(50);

            const start = Date.now();
            const suggestions = await fetchSuggestions(3, null);
            const duration = Date.now() - start;

            return {
                context: {
                    friends: friendsCount,
                    interactions: interactionsCount,
                    candidates: candidates.length,
                },
                result: {
                    count: suggestions.length,
                    durationMs: duration,
                    types: suggestions.map(s => s.type),
                    categories: suggestions.map(s => s.category),
                    titles: suggestions.map(s => s.title)
                }
            };
        } catch (error) {
            console.error('Diagnostic failed:', error);
            throw error;
        }
    },

    async clearDismissed() {
        await SuggestionStorageService.clearAllDismissed();
    },

    /**
     * Fixes data integrity issues for legacy datasets.
     * 1. Recalculates and persists weave_score for all friends to ensure candidate queries work.
     */
    async fixDataIntegrity() {
        const friends = await database.get<FriendModel>('friends').query().fetch();
        let updatedCount = 0;

        await database.write(async () => {
            for (const friend of friends) {
                const currentScore = calculateCurrentScore(friend);
                const dbScore = friend.weaveScore;

                // If score is significantly different or missing (if that were possible), update it
                if (Math.abs(currentScore - dbScore) > 0.1 || isNaN(dbScore)) {
                    await friend.update(f => {
                        f.weaveScore = currentScore;
                    });
                    updatedCount++;
                }
            }
        });

        return {
            processed: friends.length,
            updated: updatedCount
        };
    }
};
