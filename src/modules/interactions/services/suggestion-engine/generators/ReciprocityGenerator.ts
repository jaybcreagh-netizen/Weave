import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getSmartCategory } from '../utils';
import { getContextualSuggestion } from '../contextual-utils';
import FriendModel from '@/db/models/Friend';

export class ReciprocityGenerator implements SuggestionGenerator {
    name = 'ReciprocityGenerator';
    priority = 50; // Priority 10 & 11

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, recentInteractions, now } = context;
        const friendModel = friend as unknown as FriendModel;

        // PRIORITY 10: Reciprocity imbalance (user initiating too much)
        if (friendModel.initiationRatio !== undefined && friendModel.initiationRatio > 0.75) {
            const totalInteractions = (friendModel.totalUserInitiations || 0) + (friendModel.totalFriendInitiations || 0);

            // Only show if we have enough data points (5+ interactions)
            if (totalInteractions >= 5) {
                const consecutive = friendModel.consecutiveUserInitiations || 0;
                const urgency: 'low' | 'medium' = consecutive >= 4 ? 'medium' : 'low';

                const subtitle = consecutive >= 4
                    ? `You've initiated ${consecutive} times in a row. Give ${friend.name} space to reach out.`
                    : `You've driven ${Math.round(friendModel.initiationRatio * 100)}% of interactions. Let them initiate next.`;

                return {
                    id: `reciprocity-imbalance-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency,
                    category: 'insight',
                    title: `Rebalance with ${friend.name}`,
                    subtitle,
                    actionLabel: 'Pause & Wait',
                    icon: 'Scale',
                    action: { type: 'reflect' },
                    dismissible: true,
                    createdAt: now,
                    type: 'reflect',
                };
            }
        }

        // PRIORITY 11: Reciprocity imbalance (friend initiating too much - user not investing)
        if (friendModel.initiationRatio !== undefined && friendModel.initiationRatio < 0.25) {
            const totalInteractions = (friendModel.totalUserInitiations || 0) + (friendModel.totalFriendInitiations || 0);

            if (totalInteractions >= 5 && friend.dunbarTier !== 'Community') {
                const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, undefined, friend);

                return {
                    id: `reciprocity-invest-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'medium',
                    category: 'insight',
                    title: `Invest more in ${friend.name}`,
                    subtitle: `${friend.name} usually reaches out first. Show you value them. ${contextualAction}`,
                    actionLabel: 'Reach Out',
                    icon: 'Heart',
                    action: {
                        type: 'log',
                        prefilledCategory: getSmartCategory(friend).category as any,
                    },
                    dismissible: true,
                    createdAt: now,
                    type: 'connect',
                };
            }
        }

        return null;
    }
}
