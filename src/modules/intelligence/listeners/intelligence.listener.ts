import { eventBus } from '@/shared/events/event-bus';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { Q } from '@nozbe/watermelondb';
import { processWeaveScoring } from '../services/orchestrator.service';
import { analyzeTierFit } from '@/modules/insights/services/tier-fit.service';
import { updateTierFit } from '@/modules/insights/services/tier-management.service';
import { checkTierSuggestionAfterInteraction } from '@/modules/insights/services/tier-suggestion-engine.service';
import { analyzeAndTagLifeEvents } from '@/modules/relationships/services/life-event-detection';
import { insightOrchestratorService } from '../services/InsightOrchestratorService';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import FriendModel from '@/db/models/Friend';
import { type InteractionFormData } from '@/shared/types/scoring.types';

// Extract handler to allow removal
const handleInteractionCreated = async (payload: any) => {
    const { interactionId, friends: payloadFriends, data } = payload as { interactionId: string, friends: FriendModel[], data: InteractionFormData };

    const startTime = Date.now();
    Logger.info('[Intelligence] Processing interaction:created event - START');

    // Only process scoring for completed logs, not for plans.
    // Plans are scored later when completed via completePlan() or auto-scored via checkPendingPlans().
    if (data.type === 'plan' || data.status !== 'completed') {
        Logger.info('[Intelligence] Skipping scoring for non-completed interaction (plan or pending)');
        return;
    }

    // SAFETY: Refetch friends to ensure we have fresh models and avoid "pending changes" errors
    // if the payload instances are stale or locked by the previous transaction.
    const friendIds = payloadFriends.map(f => f.id);
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();

    try {
        // Scoring (with season-aware bonuses)
        const scoringStart = Date.now();
        const profileCollection = database.get<UserProfile>('user_profile');
        const profile = (await profileCollection.query().fetch())[0];
        const currentSeason = profile?.currentSocialSeason || 'balanced' as any;
        // v61: Pass interactionId to store pointsEarned in InteractionFriend records
        await processWeaveScoring(friends, data, database, currentSeason, interactionId);
        Logger.info(`[Intelligence] Scoring completed in ${Date.now() - scoringStart}ms`);

        // Track scoring event
        try {
            const pointsStart = Date.now();
            // Fetch the interaction friends to sum up points
            const interactionFriends = await database.get('interaction_friends')
                .query(Q.where('interaction_id', interactionId))
                .fetch();

            const totalPoints = interactionFriends.reduce((sum, record: any) => sum + (record.pointsEarned || 0), 0);

            trackEvent(AnalyticsEvents.INTERACTION_SCORED, {
                total_points: totalPoints,
                friend_count: friends.length,
                friends_scored: interactionFriends.length
            });
            Logger.info(`[Intelligence] Tracked INTERACTION_SCORED with ${totalPoints} points in ${Date.now() - pointsStart}ms`);
        } catch (err) {
            Logger.warn('[Intelligence] Failed to track INTERACTION_SCORED:', err);
        }

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

        // Relationship Intelligence (Phase 3)
        // Updates RQS, Reciprocity, and generates insights
        const insightStart = Date.now();
        try {
            await insightOrchestratorService.processInteraction(interactionId);
            Logger.info(`[Intelligence] InsightOrchestrator completed in ${Date.now() - insightStart}ms`);
        } catch (error) {
            Logger.error('[Intelligence] Error in InsightOrchestrator:', error);
        }

        Logger.info(`[Intelligence] TOTAL processing time: ${Date.now() - startTime}ms`);
    } catch (error) {
        Logger.error('[Intelligence] Error processing interaction event:', error);
    }
};

export function setupIntelligenceListeners() {
    eventBus.on('interaction:created', (payload: any) => {
        // IMPORTANT: Defer processing to next tick to avoid writer queue contention.
        // The logWeave() call emits this event while still holding a writer lock.
        // If we try to read/write immediately, we queue behind it, causing 2+ second delays.
        setTimeout(() => handleInteractionCreated(payload), 0);
    });

    // Return cleanup function
    return () => {
        eventBus.off('interaction:created', handleInteractionCreated);
    };
}
