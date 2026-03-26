import { analyzeInteractionPattern, getPatternDescription, isPatternReliable } from '@/modules/insights';
import { getArchetypeDormantTitle, getArchetypeDriftTitle } from '@/shared/constants/archetype-content';
import type { Suggestion } from '@/shared/types/common';
import { getContextualSuggestion } from '../contextual-utils';
import { getSmartCategory } from '../utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DriftMode = 'critical' | 'high' | 'community';

interface DriftDescriptor {
    mode: DriftMode;
    title: string;
    subtitle: string;
    actionLabel: string;
    suggestionAction: Suggestion['action'];
    suggestionType: Suggestion['type'];
    suggestionCategory: Opportunity['category'];
    dismissible: boolean;
}

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

function buildDescriptor(context: SuggestionContext): DriftDescriptor | null {
    const { friend, currentScore, recentInteractions } = context;

    if (hasPlannedWeaveSoon(context)) {
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
    const patternContext = isPatternReliable(pattern)
        ? ` ${getPatternDescription(pattern)}.`
        : '';
    const smartCategory = getSmartCategory(friend).category as any;

    if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
        return {
            mode: 'critical',
            title: getArchetypeDormantTitle(friend.archetype, friend.name),
            subtitle: `${contextualAction}.${patternContext}`,
            actionLabel: 'Reach Out',
            suggestionAction: {
                type: 'log',
                prefilledCategory: smartCategory,
                prefilledMode: 'detailed',
            },
            suggestionType: 'reconnect',
            suggestionCategory: 'critical-drift',
            dismissible: false,
        };
    }

    const isHighDrift =
        (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
        (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

    if (isHighDrift) {
        return {
            mode: 'high',
            title: getArchetypeDriftTitle(friend.archetype, friend.name),
            subtitle: `${contextualAction}.${patternContext}`,
            actionLabel: 'Plan',
            suggestionAction: {
                type: 'plan',
                prefilledCategory: smartCategory,
            },
            suggestionType: 'reconnect',
            suggestionCategory: 'high-drift',
            dismissible: true,
        };
    }

    if (friend.dunbarTier === 'Community' && currentScore < 40 && currentScore >= 20) {
        return {
            mode: 'community',
            title: `Reconnect with ${friend.name}`,
            subtitle: `This community connection could use some attention. ${contextualAction}`,
            actionLabel: 'Reach Out',
            suggestionAction: {
                type: 'log',
                prefilledCategory: 'text-call' as any,
            },
            suggestionType: 'connect',
            suggestionCategory: 'community-checkin',
            dismissible: true,
        };
    }

    return null;
}

export function buildDriftSuggestion(context: SuggestionContext): Suggestion | null {
    const descriptor = buildDescriptor(context);
    if (!descriptor) {
        return null;
    }

    const icon = descriptor.mode === 'community' ? 'Users' : 'Wind';
    const urgency = descriptor.mode === 'critical'
        ? 'critical'
        : descriptor.mode === 'high'
            ? 'high'
            : 'low';
    const idPrefix = descriptor.mode === 'community'
        ? 'community-drift'
        : `${descriptor.mode}-drift`;

    return {
        id: `${idPrefix}-${context.friend.id}`,
        friendId: context.friend.id,
        friendName: context.friend.name,
        urgency,
        category: descriptor.suggestionCategory,
        title: descriptor.title,
        subtitle: descriptor.subtitle,
        actionLabel: descriptor.actionLabel,
        icon,
        action: descriptor.suggestionAction,
        dismissible: descriptor.dismissible,
        createdAt: context.now,
        type: descriptor.suggestionType,
    };
}

export function buildDriftOpportunity(context: SuggestionContext): Opportunity | null {
    const descriptor = buildDescriptor(context);
    if (!descriptor) {
        return null;
    }

    const urgency = descriptor.mode === 'critical'
        ? 95
        : descriptor.mode === 'high'
            ? 76
            : 38;
    const estimatedDurationMinutes = descriptor.mode === 'critical' ? 10 : 30;

    return {
        id: `${descriptor.mode === 'community' ? 'community-drift' : `${descriptor.mode}-drift`}-${context.friend.id}`,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: descriptor.mode === 'community' ? 'community-checkin' : descriptor.suggestionCategory,
        generatorSource: 'drift-generator',
        urgency,
        confidence: descriptor.mode === 'community' ? 0.65 : 0.82,
        effortLevel: descriptor.mode === 'critical' ? 'minimal' : 'moderate',
        estimatedDurationMinutes,
        explanation: {
            whyNow: descriptor.subtitle,
            whyThisFriend: `${context.friend.name} is drifting relative to their relationship tier.`,
            whyThisAction: descriptor.mode === 'critical'
                ? 'A lightweight reach-out is the safest next move.'
                : 'A concrete plan is the best way to stop further drift.',
        },
        timeRelevance: {
            bestWindow: descriptor.mode === 'critical' ? 'midday' : 'morning',
        },
        copyContext: {
            lastInteractionAt: context.lastInteractionDate?.getTime(),
            daysSinceLastInteraction: context.lastInteractionDate
                ? Math.max(
                    0,
                    Math.round((context.now.getTime() - context.lastInteractionDate.getTime()) / 86400000)
                )
                : undefined,
            recentInteractionCategory: descriptor.suggestionAction.prefilledCategory,
        },
        createdAt: context.now.getTime(),
    };
}
