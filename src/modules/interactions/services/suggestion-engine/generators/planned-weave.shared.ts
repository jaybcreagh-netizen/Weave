import { getCategoryLabel } from '../utils';
import type { Suggestion } from '@/shared/types/common';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

function getRelevantPlan(context: SuggestionContext) {
    const { plannedInteractions, now } = context;
    if (!plannedInteractions || plannedInteractions.length === 0) {
        return null;
    }

    const nowTime = now.getTime();
    const relevantPlans = [...plannedInteractions].sort((a, b) => {
        const timeA = a.interactionDate instanceof Date
            ? a.interactionDate.getTime()
            : new Date(a.interactionDate || 0).getTime();
        const timeB = b.interactionDate instanceof Date
            ? b.interactionDate.getTime()
            : new Date(b.interactionDate || 0).getTime();
        return timeA - timeB;
    });

    for (const plan of relevantPlans) {
        const planStart = plan.interactionDate instanceof Date
            ? plan.interactionDate.getTime()
            : new Date(plan.interactionDate || 0).getTime();
        const planEnd = plan.endDate instanceof Date
            ? plan.endDate.getTime()
            : (plan.endDate ? new Date(plan.endDate || 0).getTime() : planStart);
        const hoursUntilStart = (planStart - nowTime) / 3600000;
        const hoursSinceEnd = (nowTime - planEnd) / 3600000;

        if (hoursSinceEnd > 0 && hoursSinceEnd <= 168) {
            return { mode: 'past-due' as const, plan, planStart, planEnd, hoursUntilStart, hoursSinceEnd };
        }

        if (hoursUntilStart >= 0 && hoursUntilStart <= 48) {
            return { mode: 'upcoming' as const, plan, planStart, planEnd, hoursUntilStart, hoursSinceEnd };
        }

        if (planStart <= nowTime && planEnd >= nowTime) {
            return { mode: 'active' as const, plan, planStart, planEnd, hoursUntilStart, hoursSinceEnd };
        }
    }

    return null;
}

export function buildPlannedWeaveSuggestion(context: SuggestionContext): Suggestion | null {
    const relevant = getRelevantPlan(context);
    if (!relevant) {
        return null;
    }

    const { friend, now } = context;
    if (relevant.mode === 'past-due') {
        return {
            id: `past-plan-${relevant.plan.id}`,
            friendId: friend.id,
            friendName: friend.name,
            urgency: 'high',
            category: 'maintain',
            title: 'Did you meet?',
            subtitle: `You had a plan with ${friend.name} for ${getCategoryLabel(relevant.plan.interactionCategory || 'hangout')}. Mark it complete?`,
            actionLabel: 'Log Weave',
            icon: 'CheckCircle',
            action: {
                type: 'log',
                prefilledCategory: relevant.plan.interactionCategory as any,
            },
            dismissible: true,
            createdAt: now,
            type: 'connect',
        };
    }

    if (relevant.mode === 'upcoming') {
        const timeText = relevant.hoursUntilStart < 24 ? 'today' : 'tomorrow';
        return {
            id: `upcoming-plan-${relevant.plan.id}`,
            friendId: friend.id,
            friendName: friend.name,
            urgency: 'medium',
            category: 'plan',
            title: 'Upcoming Plan',
            subtitle: `You have a plan with ${friend.name} ${timeText}.`,
            actionLabel: 'View',
            icon: 'Calendar',
            action: { type: 'plan' },
            dismissible: true,
            createdAt: now,
            type: 'connect',
        };
    }

    return {
        id: `active-plan-${relevant.plan.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'plan',
        title: 'Plan in progress',
        subtitle: `Your plan with ${friend.name} is happening now.`,
        actionLabel: 'View',
        icon: 'Calendar',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: now,
        type: 'connect',
    };
}

export function buildPlannedWeaveOpportunity(context: SuggestionContext): Opportunity | null {
    const suggestion = buildPlannedWeaveSuggestion(context);
    if (!suggestion) {
        return null;
    }

    const isPastDue = suggestion.id.startsWith('past-plan-');

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'maintain',
        generatorSource: 'planned-weave-generator',
        urgency: isPastDue ? 80 : 60,
        confidence: 0.95,
        effortLevel: isPastDue ? 'minimal' : 'minimal',
        estimatedDurationMinutes: 10,
        explanation: {
            whyNow: suggestion.subtitle,
            whyThisFriend: `${context.friend.name} already has a concrete plan linked to them.`,
            whyThisAction: isPastDue
                ? 'Closing the loop on the weave is the best next step.'
                : 'You already have momentum here, so a quick review is enough.',
        },
        timeRelevance: {
            bestWindow: isPastDue ? 'evening' : 'midday',
            deadlineAt: context.plannedInteractions?.[0]?.interactionDate?.getTime?.(),
        },
        copyContext: {
            recentInteractionCategory: suggestion.action.prefilledCategory,
        },
        createdAt: context.now.getTime(),
    };
}
