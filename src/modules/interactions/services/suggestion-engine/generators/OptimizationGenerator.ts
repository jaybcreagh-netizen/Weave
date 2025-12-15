import { Suggestion, InteractionCategory } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getContextualSuggestion } from '../contextual-utils';

export class OptimizationGenerator implements SuggestionGenerator {
    name = 'OptimizationGenerator';
    priority = 45; // Between Maintenance (35) and Reciprocity (50)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, currentScore, recentInteractions, now } = context;

        // TARGET: Healthy/Success state (Score > 80)
        // We want to prevent boredom/rut by suggesting NOVELTY.
        if (currentScore > 80) {

            // 1. Identify recently used categories
            const recentCategories = new Set(
                recentInteractions.map(i => i.interactionCategory)
            );

            // 2. define pool of "High Value" categories we want to encourage
            // We exclude low-effort ones like 'text-call' or 'voice-note' if they are already thriving
            const noveltyPool: InteractionCategory[] = [
                'hangout',
                'activity-hobby',
                'meal-drink',
                'deep-talk',
                'event-party'
            ];

            // 3. Find a category they HAVEN'T done recently
            const novelCategory = noveltyPool.find(c => !recentCategories.has(c));

            if (novelCategory) {
                const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, undefined, friend);

                return {
                    id: `optimization-novelty-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'low',
                    category: 'variety',
                    title: `Try something new with ${friend.name}`,
                    subtitle: `You're doing great! Why not switch it up? ${contextualAction}`,
                    actionLabel: 'Plan',
                    icon: 'Sparkles', // Or a "Shuffle" icon if available
                    action: {
                        type: 'plan',
                        prefilledCategory: novelCategory as any, // Cast to match Suggestion types
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
