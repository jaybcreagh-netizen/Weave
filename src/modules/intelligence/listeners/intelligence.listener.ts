import { eventBus } from '@/shared/events/event-bus';
import { processWeaveScoring } from '../services/orchestrator.service';
import { analyzeTierFit } from '@/modules/insights/services/tier-fit.service';
import { updateTierFit } from '@/modules/insights/services/tier-management.service';
import { checkTierSuggestionAfterInteraction } from '@/modules/insights/services/tier-suggestion-engine.service';
import { analyzeAndTagLifeEvents } from '@/modules/relationships/services/life-event-detection';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import FriendModel from '@/db/models/Friend';
import { type InteractionFormData } from '@/shared/types/scoring.types';

export function setupIntelligenceListeners() {
    eventBus.on('interaction:created', async (payload: any) => {
        const { friends, data } = payload as { friends: FriendModel[], data: InteractionFormData };
        const startTime = Date.now();

        Logger.info('[Intelligence] Processing interaction:created event - START');

        // Only process scoring for completed logs, not for plans.
        // Plans are scored later when completed via completePlan() or auto-scored via checkPendingPlans().
        if (data.type === 'plan' || data.status !== 'completed') {
            Logger.info('[Intelligence] Skipping scoring for non-completed interaction (plan or pending)');
            return;
        }

        try {
            // Scoring (with season-aware bonuses)
            const scoringStart = Date.now();
            const profileCollection = database.get<UserProfile>('user_profile');
            const profile = (await profileCollection.query().fetch())[0];
            const currentSeason = profile?.currentSocialSeason || 'balanced' as any;
            await processWeaveScoring(friends, data, database, currentSeason);
            Logger.info(`[Intelligence] Scoring completed in ${Date.now() - scoringStart}ms`);

            // Insights (Life Events)
            const lifeEventsStart = Date.now();
            if (data.notes && data.notes.trim().length > 0) {
                for (const friend of friends) {
                    try {
                        await analyzeAndTagLifeEvents(friend.id, data.notes, data.date);
                    } catch (error) {
                        Logger.error('Error analyzing life events:', error);
                    }
                }
            }
            Logger.info(`[Intelligence] Life events analysis completed in ${Date.now() - lifeEventsStart}ms`);

            // Tier Intelligence
            const tierStart = Date.now();
            for (const friend of friends) {
                try {
                    const friendStart = Date.now();
                    // Refetch friend to get updated ratedWeavesCount after scoring
                    // Note: The listener runs after the main transaction, so reading fresh is good.
                    const updatedFriend = await database.get<FriendModel>('friends').find(friend.id);
                    const wasFirstInteraction = updatedFriend.ratedWeavesCount === 1;

                    if (wasFirstInteraction) {
                        Logger.info(`[Intelligence] Skipping tier analysis for ${updatedFriend.name} (first interaction) in ${Date.now() - friendStart}ms`);
                        continue;
                    }

                    const analysis = await analyzeTierFit(updatedFriend);
                    Logger.info(`[Intelligence] Tier analysis for ${updatedFriend.name}: ${Date.now() - friendStart}ms`);

                    if (analysis.fitCategory !== 'learning' && analysis.actualIntervalDays > 0) {
                        await updateTierFit(
                            updatedFriend.id,
                            analysis.fitScore,
                            analysis.suggestedTier,
                            analysis.actualIntervalDays
                        );

                        if (analysis.suggestedTier) {
                            const suggestion = await checkTierSuggestionAfterInteraction(
                                updatedFriend.id
                            );
                            if (suggestion) {
                                Logger.info(`[Intelligence] Tier suggestion for ${updatedFriend.name}: ${analysis.currentTier} → ${analysis.suggestedTier} `);
                            }
                        }
                    }
                } catch (error) {
                    Logger.error('Error updating tier patterns:', error);
                }
            }
            Logger.info(`[Intelligence] Tier Intelligence completed in ${Date.now() - tierStart}ms`);
            Logger.info(`[Intelligence] TOTAL processing time: ${Date.now() - startTime}ms`);
        } catch (error) {
            Logger.error('[Intelligence] Error processing interaction event:', error);
        }
    });
}
