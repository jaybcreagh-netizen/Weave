import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getSmartCategory } from '../utils';
import {
    getArchetypeWarmingTitle
} from '@/shared/constants/archetype-content';
// TODO: We need to figure out where getContextualSuggestion lives or duplicate it. 
// For now I will assume I need to extract it to utils or a ContextualGenerator base class?
// Actually, getContextualSuggestion is quite complex and used by many generators.
// I should probably extract it to a standalone helper file or keep it in utils.ts
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
                // We need to resolve how to get pattern. 
                // The original service calculates pattern inside generateSuggestion using analyzeInteractionPattern
                // We should probably pass pattern in context or calculate it in Context Builder.
                // For now, let's assume we can get it or simpler version.
                // Actually, `analyzeInteractionPattern` is imported from insights.
                // Let's defer strict pattern usage or import it here if needed.
                // But getContextualSuggestion needs it.

                // For this iteration, I'll need to create `contextual-utils.ts` first or mocked.
                const contextualAction = getContextualSuggestion(
                    recentInteractions,
                    friend.archetype,
                    friend.dunbarTier,
                    undefined, // pattern - TODO: add to context
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
