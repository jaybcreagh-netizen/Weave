import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getSmartCategory } from '../utils';
import {
    getArchetypeWarmingTitle
} from '@/shared/constants/archetype-content';
import { getContextualSuggestion } from '../contextual-utils';

export class MomentumGenerator implements SuggestionGenerator {
    name = 'MomentumGenerator';
    priority = 30; // Priority 6

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, currentScore, momentumScore, lastInteractionDate, recentInteractions, now } = context;

        // PRIORITY 6: Momentum opportunity
        if (currentScore > 60 && momentumScore > 10) {
            const daysSinceLast = lastInteractionDate
                ? (now.getTime() - lastInteractionDate.getTime()) / 86400000
                : 999;

            if (daysSinceLast <= 7) {
                const contextualAction = getContextualSuggestion(
                    recentInteractions,
                    friend.archetype,
                    friend.dunbarTier,
                    undefined, // pattern optional
                    friend
                );

                return {
                    id: `momentum-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'medium',
                    category: 'deepen',
                    title: getArchetypeWarmingTitle(friend.archetype, friend.name),
                    subtitle: `Ride the wave! ${contextualAction}`,
                    actionLabel: 'Deepen',
                    icon: 'Zap',
                    action: {
                        type: 'plan',
                        prefilledCategory: getSmartCategory(friend).category as any,
                    },
                    dismissible: true,
                    createdAt: now,
                    type: 'deepen',
                };
            }
        }

        return null;
    }
}
