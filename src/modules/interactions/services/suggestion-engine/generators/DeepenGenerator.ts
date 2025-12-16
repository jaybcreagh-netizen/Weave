import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getContextualSuggestion } from '../contextual-utils';
import { getArchetypeThrivingTitle } from '@/shared/constants/archetype-content';
import { isPatternReliable, analyzeInteractionPattern } from '@/modules/insights';

export class DeepenGenerator implements SuggestionGenerator {
    name = 'DeepenGenerator';
    priority = 40; // Priority 8

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, currentScore, recentInteractions, now } = context;

        // PRIORITY 8: Deepen (thriving) - now includes Community tier with high scores
        if (currentScore > 85) {
            const pattern = analyzeInteractionPattern(
                recentInteractions.map(i => ({
                    id: i.id,
                    interactionDate: i.interactionDate,
                    status: 'completed',
                    category: i.interactionCategory,
                }))
            );

            const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern, friend);

            // Different messaging for Community tier
            const subtitle = friend.dunbarTier === 'Community'
                ? `This community connection is flourishing! ${contextualAction}`
                : `Celebrate! ${contextualAction}`;

            return {
                id: `deepen-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'low',
                category: 'celebrate',
                title: getArchetypeThrivingTitle(friend.archetype, friend.name),
                subtitle,
                actionLabel: 'Plan',
                icon: 'Sparkles',
                action: { type: 'plan' },
                dismissible: true,
                createdAt: now,
                type: 'celebrate',
            };
        }

        return null;
    }
}
