import { analyzeInteractionPattern, calculateToleranceWindow, isPatternReliable } from '@/modules/insights';
import { getArchetypeNewTitle } from '@/shared/constants/archetype-content';
import type { Suggestion } from '@/shared/types/common';
import { getContextualSuggestion } from '../contextual-utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function hasPlannedWeaveSoon(context: SuggestionContext): boolean {
    const { plannedInteractions, now } = context;
    if (!plannedInteractions || plannedInteractions.length === 0) {
        return false;
    }

    const nowTime = now.getTime();
    return plannedInteractions.some(plan => {
        const planStart = plan.interactionDate instanceof Date
            ? plan.interactionDate.getTime()
            : new Date(plan.interactionDate || 0).getTime();
        const planEnd = plan.endDate instanceof Date
            ? plan.endDate.getTime()
            : (plan.endDate ? new Date(plan.endDate || 0).getTime() : planStart);
        return planEnd >= nowTime && planStart < nowTime + SEVEN_DAYS_MS;
    });
}

export function buildMaintenanceSuggestion(context: SuggestionContext): Suggestion | null {
    const { friend, interactionCount, currentScore, lastInteractionDate, recentInteractions, now } = context;

    if (hasPlannedWeaveSoon(context)) {
        return null;
    }

    if (interactionCount === 0) {
        const daysSinceAdded = friend.createdAt
            ? (now.getTime() - friend.createdAt.getTime()) / 86400000
            : 0;

        if (daysSinceAdded >= 1) {
            if (friend.dunbarTier === 'Community' && currentScore >= 35) {
                return null;
            }

            return {
                id: `first-weave-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'medium',
                category: 'maintain',
                title: getArchetypeNewTitle(friend.archetype, friend.name),
                subtitle: 'Log your first interaction.',
                actionLabel: 'Log',
                icon: 'Sparkles',
                action: { type: 'log' },
                dismissible: true,
                createdAt: now,
                type: 'connect',
            };
        }
    }

    const daysSinceInteraction = lastInteractionDate
        ? (now.getTime() - lastInteractionDate.getTime()) / 86400000
        : 999;

    const pattern = analyzeInteractionPattern(
        recentInteractions.map(interaction => ({
            id: interaction.id,
            interactionDate: interaction.interactionDate,
            status: 'completed',
            category: interaction.interactionCategory,
        }))
    );

    const maintenanceThreshold = isPatternReliable(pattern)
        ? calculateToleranceWindow(pattern)
        : {
            InnerCircle: 7,
            CloseFriends: 14,
            Community: 21,
        }[friend.dunbarTier];

    if (currentScore >= 40 && maintenanceThreshold && daysSinceInteraction > maintenanceThreshold) {
        const contextualAction = getContextualSuggestion(
            recentInteractions,
            friend.archetype,
            friend.dunbarTier,
            pattern,
            friend
        );
        const title = isPatternReliable(pattern)
            ? `${pattern.averageIntervalDays}-day check-in: ${friend.name}`
            : `Keep warm with ${friend.name}`;

        return {
            id: `maintenance-${friend.id}`,
            friendId: friend.id,
            friendName: friend.name,
            urgency: 'low',
            category: 'maintain',
            title,
            subtitle: contextualAction,
            actionLabel: 'Plan',
            icon: 'Clock',
            action: {
                type: 'plan',
                prefilledCategory: pattern.preferredCategories[0] || 'text-call' as any,
            },
            dismissible: true,
            createdAt: now,
            type: 'connect',
        };
    }

    return null;
}

export function buildMaintenanceOpportunity(context: SuggestionContext): Opportunity | null {
    const suggestion = buildMaintenanceSuggestion(context);
    if (!suggestion) {
        return null;
    }

    const isFirstWeave = suggestion.id.startsWith('first-weave-');

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: isFirstWeave ? 'first-weave' : 'maintain',
        generatorSource: 'maintenance-generator',
        urgency: isFirstWeave ? 58 : 34,
        confidence: isFirstWeave ? 0.75 : 0.72,
        effortLevel: isFirstWeave ? 'minimal' : 'moderate',
        estimatedDurationMinutes: isFirstWeave ? 10 : 30,
        explanation: {
            whyNow: suggestion.subtitle,
            whyThisFriend: isFirstWeave
                ? `${context.friend.name} is a new relationship without a first logged weave yet.`
                : `${context.friend.name} is due for a healthy check-in cadence.`,
            whyThisAction: isFirstWeave
                ? 'A first touchpoint will turn this relationship into a lived connection.'
                : 'A lightweight plan keeps this relationship warm without waiting for drift.',
        },
        timeRelevance: {
            bestWindow: isFirstWeave ? 'midday' : 'evening',
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
