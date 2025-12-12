import { eventBus } from '@/shared/events/event-bus';
import { checkAndAwardFriendBadges } from '../services/badge.service';
import { checkAndAwardGlobalAchievements } from '../services/achievement.service';
import { recordPractice } from '../services/milestone-tracker.service';
import Logger from '@/shared/utils/Logger';
import FriendModel from '@/db/models/Friend';

export function setupGamificationListeners() {
    eventBus.on('interaction:created', async (payload: any) => {
        const { interactionId, friends } = payload as { interactionId: string, friends: FriendModel[] };

        Logger.info('[Gamification] Processing interaction:created event');

        try {
            // Badges & Achievements
            for (const friend of friends) {
                await checkAndAwardFriendBadges(friend.id, friend.name);
            }

            await checkAndAwardGlobalAchievements();

            // Gamification
            await recordPractice('log_weave', interactionId);

        } catch (error) {
            Logger.error('[Gamification] Error processing interaction event:', error);
        }
    });
}
