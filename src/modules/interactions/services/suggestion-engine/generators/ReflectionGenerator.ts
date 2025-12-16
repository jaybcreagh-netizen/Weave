import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getCategoryLabel } from '../utils';

export class ReflectionGenerator implements SuggestionGenerator {
    name = 'ReflectionGenerator';
    priority = 15; // Priority 3

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, recentInteractions, now } = context;

        if (recentInteractions.length === 0) return null;

        const mostRecent = recentInteractions[0];
        const nowTime = now.getTime();

        if (!mostRecent.interactionDate) return null;

        // Handle both Date object and string date (just in case)
        const interactionTime = mostRecent.interactionDate instanceof Date ?
            mostRecent.interactionDate.getTime() :
            new Date(mostRecent.interactionDate).getTime();

        // Future interaction check
        if (interactionTime > nowTime) return null;

        const hoursSince = (nowTime - interactionTime) / 3600000;

        // Must be recent (within 24 hours) and missing reflection data
        if (hoursSince < 24 && hoursSince >= 0 && (!mostRecent.note || !mostRecent.vibe)) {
            const activityLabel = mostRecent.interactionCategory ? getCategoryLabel(mostRecent.interactionCategory) : 'time together';

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
                expiresAt: new Date(nowTime + 24 * 60 * 60 * 1000), // Expires in 24h
                type: 'reflect',
            };
        }

        return null;
    }
}
