import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { calculateToleranceWindow, isPatternReliable, analyzeInteractionPattern } from '@/modules/insights';
import { getContextualSuggestion } from '../contextual-utils';
import { getArchetypeNewTitle } from '@/shared/constants/archetype-content';

export class MaintenanceGenerator implements SuggestionGenerator {
    name = 'MaintenanceGenerator';
    priority = 35; // Priority 7 and 4b (First Weave)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, interactionCount, currentScore, lastInteractionDate, recentInteractions, now } = context;

        // PRIORITY 4(b): First weave (new friend)
        // Handled here or in dedicated FirstWeave generator. 
        // Original logic had this at Priority 4, but let's group it with Maintenance/Drift conceptually 
        // or just implement it here since it's "maintenance" of a new relationship.
        // Actually, original code has First Weave at Priority 4, which is HIGHER than Maintenance (7).
        // To be strictly faithful to the waterfall, we might need to handle it in Drift or its own generator.
        // But let's check the condition: if interactionCount === 0.
        // If count is 0, other generators relying on history (Momentum, Maintenance) won't trigger anyway.
        // So checking it here is safe.

        if (interactionCount === 0) {
            const daysSinceAdded = friend.createdAt
                ? (now.getTime() - friend.createdAt.getTime()) / 86400000
                : 0;

            if (daysSinceAdded >= 1) {
                // Reduce noise: Only suggest first weave for Community friends if their health is low (< 35)
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

        // PRIORITY 7: Maintenance (expanded for healthy networks)
        const daysSinceInteraction = lastInteractionDate
            ? (now.getTime() - lastInteractionDate.getTime()) / 86400000
            : 999;

        // We need pattern for maintenance calculation
        const pattern = analyzeInteractionPattern(
            recentInteractions.map(i => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: 'completed',
                category: i.interactionCategory,
            }))
        );

        // Use learned pattern for threshold, or fall back to tier defaults
        const maintenanceThreshold = isPatternReliable(pattern)
            ? calculateToleranceWindow(pattern)
            : {
                InnerCircle: 7,
                CloseFriends: 14,
                Community: 21,
            }[friend.dunbarTier];

        // Global Maintenance (Fallback for high scores too)
        // Was 40-85, now 40+ to ensure we catch those who fall through DeepenGenerator
        if (currentScore >= 40 && maintenanceThreshold && daysSinceInteraction > maintenanceThreshold) {
            const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern, friend);

            // Create pattern-aware title
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
}
