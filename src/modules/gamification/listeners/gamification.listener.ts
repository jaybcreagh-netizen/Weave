import { eventBus } from '@/shared/events/event-bus';
import { checkAndAwardFriendBadges } from '../services/badge.service';
import { checkAndAwardGlobalAchievements } from '../services/achievement.service';
import { recordPractice } from '../services/milestone-tracker.service';
import Logger from '@/shared/utils/Logger';
import FriendModel from '@/db/models/Friend';

export function setupGamificationListeners() {
    eventBus.on('interaction:created', async (payload: any) => {
        const { interactionId, friends, data } = payload as { interactionId: string, friends: FriendModel[], data: { type?: string, status?: string } };
        const startTime = Date.now();

        Logger.info('[Gamification] Processing interaction:created event - START');

        // Only process gamification for completed logs, not for plans.
        // Plans trigger gamification when they are completed.
        if (data?.type === 'plan' || data?.status !== 'completed') {
            Logger.info('[Gamification] Skipping gamification for non-completed interaction');
            return;
        }

        try {
            // Badges & Achievements
            const badgesStart = Date.now();
            for (const friend of friends) {
                const friendBadgeStart = Date.now();
                await checkAndAwardFriendBadges(friend.id, friend.name);
                Logger.info(`[Gamification] Friend badges for ${friend.name}: ${Date.now() - friendBadgeStart}ms`);
            }
            Logger.info(`[Gamification] All friend badges: ${Date.now() - badgesStart}ms`);

            const achievementsStart = Date.now();
            await checkAndAwardGlobalAchievements();
            Logger.info(`[Gamification] Global achievements: ${Date.now() - achievementsStart}ms`);

            // Gamification
            const practiceStart = Date.now();
            await recordPractice('log_weave', interactionId);
            Logger.info(`[Gamification] Record practice: ${Date.now() - practiceStart}ms`);

            Logger.info(`[Gamification] TOTAL processing time: ${Date.now() - startTime}ms`);
        } catch (error) {
            Logger.error('[Gamification] Error processing interaction event:', error);
        }
    });
}
