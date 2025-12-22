import { HydratedFriend } from '@/types/hydrated';
import FriendModel from '@/db/models/Friend';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';
import { getAllLearnedEffectiveness } from '@/modules/insights';
import { RelationshipType, InteractionCategory } from '@/shared/types/common';

/**
 * Preferred interaction categories by relationship type.
 * These influence the pre-filled category when suggesting interactions.
 * Order matters - first category is most preferred.
 */
export const RelationshipTypePreferredCategories: Record<RelationshipType, InteractionCategory[]> = {
    partner: ['deep-talk', 'hangout', 'meal-drink', 'activity-hobby'],
    family: ['text-call', 'meal-drink', 'celebration', 'favor-support'],
    colleague: ['meal-drink', 'activity-hobby', 'event-party', 'hangout'],
    mentor: ['deep-talk', 'meal-drink', 'text-call'],
    neighbor: ['hangout', 'favor-support', 'text-call'],
    creative: ['activity-hobby', 'deep-talk', 'hangout'],
    friend: [], // Empty - defer to archetype
};

/**
 * Gets the preferred category for a relationship type.
 * Returns undefined if no preference (should fall through to archetype).
 */
function getRelationshipTypePreferredCategory(
    relationshipType: RelationshipType | undefined
): InteractionCategory | undefined {
    if (!relationshipType || relationshipType === 'friend') {
        return undefined;
    }

    const preferences = RelationshipTypePreferredCategories[relationshipType];
    return preferences?.[0];
}

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
 * Falls back to relationship type preference, then archetype preference.
 *
 * Priority order:
 * 1. Learned effectiveness (if enough data and clear winner)
 * 2. Relationship type preference (partner → deep-talk, colleague → meal-drink, etc.)
 * 3. Archetype preference (fallback)
 */
export function getSmartCategory(
    friend: HydratedFriend,
    minOutcomes: number = 3
): { category: string; isLearned: boolean; source: 'learned' | 'relationship' | 'archetype' } {
    const archetypePref = getArchetypePreferredCategory(friend.archetype);
    const relationshipType = friend.relationshipType as RelationshipType | undefined;
    const relationshipPref = getRelationshipTypePreferredCategory(relationshipType);

    // Need minimum outcomes to trust learned data
    const friendModel = friend as unknown as FriendModel;
    if ((friendModel.outcomeCount || 0) >= minOutcomes) {
        const effectiveness = getAllLearnedEffectiveness(friendModel);

        // Find most effective category (must be 15%+ better than average)
        const sorted = Object.entries(effectiveness)
            .filter(([_, ratio]) => ratio > 1.15)
            .sort(([, a], [, b]) => b - a);

        if (sorted.length > 0) {
            return {
                category: sorted[0][0],
                isLearned: true,
                source: 'learned',
            };
        }
    }

    // Fall back to relationship type preference if available
    if (relationshipPref) {
        return {
            category: relationshipPref,
            isLearned: false,
            source: 'relationship',
        };
    }

    // Final fallback to archetype preference
    return { category: archetypePref, isLearned: false, source: 'archetype' };
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
