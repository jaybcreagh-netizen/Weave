import { HydratedFriend } from '@/types/hydrated';
import FriendModel from '@/db/models/Friend';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';
import { getAllLearnedEffectiveness } from '@/modules/insights';

export const CATEGORY_LABELS: Record<string, string> = {
    'text-call': 'chat',
    'meal-drink': 'meal',
    'hangout': 'hangout',
    'deep-talk': 'deep conversation',
    'activity-hobby': 'activity',
    'event-party': 'event',
    'favor-support': 'time together',
    'celebration': 'celebration',
};

export function getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] || 'time together';
}

export function getDaysText(days: number | undefined): string {
    if (days === undefined || isNaN(days)) return 'soon';
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
}

/**
 * Gets smart category recommendation based on learned effectiveness data.
 * Falls back to archetype preference if not enough data or no clear winner.
 */
export function getSmartCategory(
    friend: HydratedFriend,
    minOutcomes: number = 3
): { category: string; isLearned: boolean } {
    const archetypePref = getArchetypePreferredCategory(friend.archetype);

    // Need minimum outcomes to trust learned data
    const friendModel = friend as unknown as FriendModel;
    if ((friendModel.outcomeCount || 0) < minOutcomes) {
        return { category: archetypePref, isLearned: false };
    }

    const effectiveness = getAllLearnedEffectiveness(friendModel);

    // Find most effective category (must be 15%+ better than average)
    const sorted = Object.entries(effectiveness)
        .filter(([_, ratio]) => ratio > 1.15)
        .sort(([, a], [, b]) => b - a);

    if (sorted.length > 0) {
        return {
            category: sorted[0][0],
            isLearned: true
        };
    }

    return { category: archetypePref, isLearned: false };
}

export const COOLDOWN_DAYS = {
    'critical-drift': 1,
    'high-drift': 2,
    'first-weave': 2,
    'life-event': 1,
    'intention-reminder': 2,
    'archetype-mismatch': 3,
    'momentum': 7,
    'maintenance': 3,
    'deepen': 7,
    'reflect': 2,
    'planned-weave': 1,
    'reciprocity-imbalance': 7,
    'reciprocity-invest': 5,
    'tier-mismatch': 14,
    'effectiveness-insight': 14,
    'community-drift': 5,
};
