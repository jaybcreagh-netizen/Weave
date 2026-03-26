import { getArchetypeWarmingTitle } from '@/shared/constants/archetype-content';
import type { Suggestion } from '@/shared/types/common';
import { getContextualSuggestion } from '../contextual-utils';
import { getSmartCategory } from '../utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

export function buildMomentumSuggestion(context: SuggestionContext): Suggestion | null {
    const { friend, currentScore, momentumScore, lastInteractionDate, recentInteractions, now } = context;

    if (currentScore <= 60 || momentumScore <= 10) {
        return null;
    }

    const daysSinceLast = lastInteractionDate
        ? (now.getTime() - lastInteractionDate.getTime()) / 86400000
        : 999;

    if (daysSinceLast > 7) {
        return null;
    }

    const contextualAction = getContextualSuggestion(
        recentInteractions,
        friend.archetype,
        friend.dunbarTier,
        undefined,
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

export function buildMomentumOpportunity(context: SuggestionContext): Opportunity | null {
    const suggestion = buildMomentumSuggestion(context);
    if (!suggestion) {
        return null;
    }

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'momentum',
        generatorSource: 'momentum-generator',
        urgency: 68,
        confidence: 0.8,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 30,
        momentumScore: context.momentumScore,
        explanation: {
            whyNow: suggestion.subtitle,
            whyThisFriend: `${context.friend.name} has recent positive momentum that is still warm.`,
            whyThisAction: 'A follow-up plan can turn recent warmth into a stronger pattern.',
        },
        timeRelevance: {
            bestWindow: 'afternoon',
        },
        copyContext: {
            lastInteractionAt: context.lastInteractionDate?.getTime(),
            daysSinceLastInteraction: context.lastInteractionDate
                ? Math.max(0, Math.round((context.now.getTime() - context.lastInteractionDate.getTime()) / 86400000))
                : undefined,
            recentInteractionCategory: suggestion.action.prefilledCategory,
        },
        createdAt: context.now.getTime(),
    };
}
