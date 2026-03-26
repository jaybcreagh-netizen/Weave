import { analyzeInteractionPattern } from '@/modules/insights';
import { getArchetypeThrivingTitle } from '@/shared/constants/archetype-content';
import type { Suggestion } from '@/shared/types/common';
import { getContextualSuggestion } from '../contextual-utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

export function buildDeepenSuggestion(context: SuggestionContext): Suggestion | null {
    const { friend, currentScore, recentInteractions, now } = context;

    if (currentScore <= 85) {
        return null;
    }

    const pattern = analyzeInteractionPattern(
        recentInteractions.map(interaction => ({
            id: interaction.id,
            interactionDate: interaction.interactionDate,
            status: 'completed',
            category: interaction.interactionCategory,
        }))
    );

    const contextualAction = getContextualSuggestion(
        recentInteractions,
        friend.archetype,
        friend.dunbarTier,
        pattern,
        friend
    );

    return {
        id: `deepen-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'low',
        category: 'celebrate',
        title: getArchetypeThrivingTitle(friend.archetype, friend.name),
        subtitle: friend.dunbarTier === 'Community'
            ? `This community connection is flourishing! ${contextualAction}`
            : `Celebrate! ${contextualAction}`,
        actionLabel: 'Plan',
        icon: 'Sparkles',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: now,
        type: 'celebrate',
    };
}

export function buildDeepenOpportunity(context: SuggestionContext): Opportunity | null {
    const suggestion = buildDeepenSuggestion(context);
    if (!suggestion) {
        return null;
    }

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'celebrate',
        generatorSource: 'deepen-generator',
        urgency: 28,
        confidence: 0.74,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 30,
        explanation: {
            whyNow: suggestion.subtitle,
            whyThisFriend: `${context.friend.name} is in a thriving relationship state right now.`,
            whyThisAction: 'This is a good moment to deepen intentionally, not just maintain.',
        },
        timeRelevance: {
            bestWindow: 'afternoon',
        },
        createdAt: context.now.getTime(),
    };
}
