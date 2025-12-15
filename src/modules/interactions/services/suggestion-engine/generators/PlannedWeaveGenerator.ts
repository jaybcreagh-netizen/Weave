import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getCategoryLabel } from '../utils';

export class PlannedWeaveGenerator implements SuggestionGenerator {
    name = 'PlannedWeaveGenerator';
    priority = 5; // Priorities 1 (past due) and 4 (upcoming)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, plannedInteractions, now } = context;

        if (!plannedInteractions || plannedInteractions.length === 0) return null;

        const nowTime = now.getTime();

        // Sort soonest first
        const relevantPlans = [...plannedInteractions].sort((a, b) => {
            const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
            const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
            return timeA - timeB;
        });

        for (const plan of relevantPlans) {
            const planTime = plan.interactionDate instanceof Date ? plan.interactionDate.getTime() : new Date(plan.interactionDate || 0).getTime();
            const hoursDiff = (planTime - nowTime) / 3600000;

            // PRIORITY 1: Past Due (within last 7 days)
            if (hoursDiff < 0 && hoursDiff > -168) {
                return {
                    id: `past-plan-${plan.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'high',
                    category: 'maintain',
                    title: 'Did you meet?',
                    subtitle: `You had a plan with ${friend.name} for ${getCategoryLabel(plan.interactionCategory || 'hangout')}. Mark it complete?`,
                    actionLabel: 'Log Weave',
                    icon: 'CheckCircle',
                    action: {
                        type: 'log',
                        prefilledCategory: plan.interactionCategory as any,
                    },
                    dismissible: true,
                    createdAt: now,
                    type: 'connect'
                };
            }

            // PRIORITY 4: Upcoming (Next 48 hours)
            if (hoursDiff >= 0 && hoursDiff <= 48) {
                const timeText = hoursDiff < 24 ? 'today' : 'tomorrow';

                return {
                    id: `upcoming-plan-${plan.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'medium',
                    category: 'plan',
                    title: 'Upcoming Plan',
                    subtitle: `You have a plan with ${friend.name} ${timeText}.`,
                    actionLabel: 'View',
                    icon: 'Calendar',
                    action: {
                        type: 'plan',
                    },
                    dismissible: true,
                    createdAt: now,
                    type: 'connect'
                };
            }
        }

        return null;
    }
}
