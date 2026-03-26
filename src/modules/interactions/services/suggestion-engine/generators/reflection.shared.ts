import { getCategoryLabel } from '../utils';
import type { Suggestion } from '@/shared/types/common';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

export function buildReflectionSuggestion(context: SuggestionContext): Suggestion | null {
    const { friend, recentInteractions, now } = context;

    if (recentInteractions.length === 0) {
        return null;
    }

    const mostRecent = recentInteractions[0];
    if (!mostRecent.interactionDate) {
        return null;
    }

    const nowTime = now.getTime();
    const interactionTime = mostRecent.interactionDate instanceof Date
        ? mostRecent.interactionDate.getTime()
        : new Date(mostRecent.interactionDate).getTime();

    if (interactionTime > nowTime) {
        return null;
    }

    const hoursSince = (nowTime - interactionTime) / 3600000;
    if (hoursSince < 24 && hoursSince >= 0 && (!mostRecent.note || !mostRecent.vibe)) {
        const activityLabel = mostRecent.interactionCategory
            ? getCategoryLabel(mostRecent.interactionCategory)
            : 'time together';

        return {
            id: `reflect-${mostRecent.id}`,
            friendId: friend.id,
            friendName: friend.name,
            urgency: 'high',
            category: 'reflect',
            title: 'Deepen this weave',
            subtitle: `How was your ${activityLabel} with ${friend.name}?`,
            actionLabel: 'Add Reflection',
            icon: '✨',
            action: {
                type: 'reflect',
                interactionId: mostRecent.id,
            },
            dismissible: true,
            createdAt: now,
            expiresAt: new Date(nowTime + 24 * 60 * 60 * 1000),
            type: 'reflect',
        };
    }

    return null;
}

export function buildReflectionOpportunity(context: SuggestionContext): Opportunity | null {
    const suggestion = buildReflectionSuggestion(context);
    if (!suggestion) {
        return null;
    }

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'reflect',
        generatorSource: 'reflection-generator',
        urgency: 74,
        confidence: 0.9,
        effortLevel: 'minimal',
        estimatedDurationMinutes: 10,
        explanation: {
            whyNow: suggestion.subtitle,
            whyThisFriend: `${context.friend.name} has a recent weave that is still fresh enough to reflect on.`,
            whyThisAction: 'Capturing reflection now preserves insight before it fades.',
        },
        timeRelevance: {
            bestWindow: 'evening',
            expiresAt: suggestion.expiresAt?.getTime(),
            deadlineAt: suggestion.expiresAt?.getTime(),
        },
        copyContext: {
            lastInteractionAt: context.recentInteractions[0]?.interactionDate?.getTime?.(),
            recentInteractionCategory: context.recentInteractions[0]?.interactionCategory,
        },
        createdAt: context.now.getTime(),
    };
}
