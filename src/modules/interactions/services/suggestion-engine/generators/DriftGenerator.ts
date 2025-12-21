import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { analyzeInteractionPattern, isPatternReliable, getPatternDescription } from '@/modules/insights';
import { getContextualSuggestion } from '../contextual-utils';
import { getArchetypeDormantTitle, getArchetypeDriftTitle } from '@/shared/constants/archetype-content';
import { getSmartCategory } from '../utils';

export class DriftGenerator implements SuggestionGenerator {
    name = 'DriftGenerator';
    priority = 20; // Priorities 3, 4, 9

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, currentScore, recentInteractions, now, plannedInteractions } = context;

        // EARLY EXIT: Skip friends with planned weaves in the next 7 days
        // No point suggesting "catch up" if they already have plans
        if (plannedInteractions && plannedInteractions.length > 0) {
            const nowTime = now.getTime();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const hasSoonPlan = plannedInteractions.some(p => {
                const planTime = p.interactionDate instanceof Date
                    ? p.interactionDate.getTime()
                    : new Date(p.interactionDate || 0).getTime();
                return planTime > nowTime && planTime < nowTime + sevenDaysMs;
            });
            if (hasSoonPlan) return null;
        }

        const pattern = analyzeInteractionPattern(
            recentInteractions.map(i => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: 'completed',
                category: i.interactionCategory,
            }))
        );

        // PRIORITY 3: Critical drift (Inner Circle emergency)
        if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
            const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern, friend);

            const patternContext = isPatternReliable(pattern)
                ? ` ${getPatternDescription(pattern)}.`
                : '';

            return {
                id: `critical-drift-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'critical',
                category: 'critical-drift',
                title: getArchetypeDormantTitle(friend.archetype, friend.name),
                subtitle: `${contextualAction}.${patternContext}`,
                actionLabel: 'Reach Out',
                icon: 'Wind',
                action: {
                    type: 'log',
                    prefilledCategory: getSmartCategory(friend).category as any, // Cast to match Suggestion types
                    prefilledMode: 'detailed',
                },
                dismissible: false,
                createdAt: now,
                type: 'reconnect',
            };
        }

        // PRIORITY 4: High drift (attention needed)
        const isHighDrift =
            (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
            (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

        if (isHighDrift) {
            const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern, friend);
            const patternContext = isPatternReliable(pattern)
                ? ` ${getPatternDescription(pattern)}.`
                : '';

            return {
                id: `high-drift-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'high',
                category: 'high-drift',
                title: getArchetypeDriftTitle(friend.archetype, friend.name),
                subtitle: `${contextualAction}.${patternContext}`,
                actionLabel: 'Plan',
                icon: 'Wind',
                action: {
                    type: 'plan',
                    prefilledCategory: getSmartCategory(friend).category as any,
                },
                dismissible: true,
                createdAt: now,
                type: 'reconnect',
            };
        }

        // PRIORITY 9: Community drift (attention needed for community members)
        // Low priority drift for community tier
        if (friend.dunbarTier === 'Community' && currentScore < 40 && currentScore >= 20) {
            const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern, friend);

            return {
                id: `community-drift-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'low',
                category: 'community-checkin',
                title: `Reconnect with ${friend.name}`,
                subtitle: `This community connection could use some attention. ${contextualAction}`,
                actionLabel: 'Reach Out',
                icon: 'Users',
                action: {
                    type: 'log',
                    prefilledCategory: 'text-call' as any,
                },
                dismissible: true,
                createdAt: now,
                type: 'connect',
            };
        }

        return null;
    }
}
