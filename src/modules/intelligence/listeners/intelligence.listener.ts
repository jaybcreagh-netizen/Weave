import { eventBus } from '@/shared/events/event-bus';
import { processWeaveScoring } from '../services/orchestrator.service';
import {
    analyzeTierFit,
    updateTierFit,
    checkTierSuggestionAfterInteraction
} from '@/modules/insights';
import { analyzeAndTagLifeEvents } from '@/modules/relationships';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import FriendModel from '@/db/models/Friend';
import { InteractionFormData } from '@/modules/interactions';

export function setupIntelligenceListeners() {
    eventBus.on('interaction:created', async (payload: any) => {
        const { friends, data } = payload as { friends: FriendModel[], data: InteractionFormData };

        Logger.info('[Intelligence] Processing interaction:created event');

        // Only process scoring for completed logs, not for plans.
        // Plans are scored later when completed via completePlan() or auto-scored via checkPendingPlans().
        if (data.type === 'plan' || data.status !== 'completed') {
            Logger.info('[Intelligence] Skipping scoring for non-completed interaction (plan or pending)');
            return;
        }

        try {
            // Scoring (with season-aware bonuses)
            const profileCollection = database.get<UserProfile>('user_profile');
            const profile = (await profileCollection.query().fetch())[0];
            const currentSeason = profile?.currentSocialSeason || 'balanced' as any;
            await processWeaveScoring(friends, data, database, currentSeason);

            // Insights (Life Events)
            if (data.notes && data.notes.trim().length > 0) {
                for (const friend of friends) {
                    try {
                        await analyzeAndTagLifeEvents(friend.id, data.notes, data.date);
                    } catch (error) {
                        Logger.error('Error analyzing life events:', error);
                    }
                }
            }

            // Tier Intelligence
            for (const friend of friends) {
                try {
                    // Refetch friend to get updated ratedWeavesCount after scoring
                    // Note: The listener runs after the main transaction, so reading fresh is good.
                    const updatedFriend = await database.get<FriendModel>('friends').find(friend.id);
                    const wasFirstInteraction = updatedFriend.ratedWeavesCount === 1;

                    if (wasFirstInteraction) {
                        continue;
                    }

                    const analysis = await analyzeTierFit(updatedFriend);

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
        } catch (error) {
            Logger.error('[Intelligence] Error processing interaction event:', error);
        }
    });
}
