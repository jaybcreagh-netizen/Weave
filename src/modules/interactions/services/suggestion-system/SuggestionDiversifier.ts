import { Suggestion } from '@/shared/types/common';
import { InteractionCategory } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';

// Low-energy archetypes that work well for quieter, less draining connections
const LOW_ENERGY_ARCHETYPES = ['Hermit', 'HighPriestess', 'Empress'];

// Low-energy activity types that require less social bandwidth
const LOW_ENERGY_CATEGORIES: InteractionCategory[] = ['text-call', 'voice-note', 'hangout'];

/**
 * Options for diverse suggestion selection
 */
export interface SelectDiverseOptions {
    /** When true, boosts friends with low-energy archetypes and low-energy activity types */
    isLowEnergy?: boolean;
    /** Friend lookup for archetype checking (needed for low-energy boost) */
    friendLookup?: Map<string, FriendModel>;
}

/**
 * Selects diverse suggestions to provide a balanced "options menu" experience.
 * Ensures variety across different action types: reflect, drift/reconnect, deepen/momentum.
 * In low-energy mode, boosts suggestions for Hermit/Empress archetypes and text/call activities.
 */
export function selectDiverseSuggestions(
    suggestions: Suggestion[],
    maxCount: number,
    options?: SelectDiverseOptions
): Suggestion[] {
    if (suggestions.length === 0) return [];

    let workingSuggestions = [...suggestions];

    // Apply low-energy boosting if enabled
    if (options?.isLowEnergy && options?.friendLookup) {
        workingSuggestions = workingSuggestions.map(s => {
            const friend = options.friendLookup?.get(s.friendId);
            const isLowEnergyArchetype = friend && LOW_ENERGY_ARCHETYPES.includes(friend.archetype || '');
            const isLowEnergyCategory = s.action?.prefilledCategory && LOW_ENERGY_CATEGORIES.includes(
                s.action.prefilledCategory as InteractionCategory
            );

            // Assign boost score for sorting
            return {
                ...s,
                _lowEnergyBoost: (isLowEnergyArchetype ? 2 : 0) + (isLowEnergyCategory ? 1 : 0),
            };
        }).sort((a, b) => {
            // First sort by low-energy boost (descending)
            const boostDiff = ((b as any)._lowEnergyBoost || 0) - ((a as any)._lowEnergyBoost || 0);
            if (boostDiff !== 0) return boostDiff;
            // Then fall through to normal urgency sorting
            return 0;
        });
    }

    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Safe urgency access
    const getUrgencyScore = (u?: string) => urgencyOrder[u as keyof typeof urgencyOrder] ?? 3;

    // Group suggestions by their action category
    const buckets = {
        critical: workingSuggestions.filter(s => s.urgency === 'critical'),
        reflect: workingSuggestions.filter(s => s.category === 'reflect'),
        lifeEvent: workingSuggestions.filter(s => s.category === 'life-event'),
        drift: workingSuggestions.filter(s => s.category === 'drift' || s.category === 'high-drift' || s.category === 'critical-drift'),
        deepen: workingSuggestions.filter(s => s.category === 'deepen' || s.category === 'celebrate'),
        maintain: workingSuggestions.filter(s => s.category === 'maintain'),
        insight: workingSuggestions.filter(s => s.category === 'insight'),
        portfolio: workingSuggestions.filter(s => s.category === 'portfolio'),
        dailyReflect: workingSuggestions.filter(s => s.category === 'daily-reflect'),
        gentleNudge: workingSuggestions.filter(s => s.category === 'gentle-nudge'),
        wildcard: workingSuggestions.filter(s => s.category === 'wildcard'),
        communityCheckin: workingSuggestions.filter(s => s.category === 'community-checkin'),
        variety: workingSuggestions.filter(s => s.category === 'variety'),
        setIntention: workingSuggestions.filter(s => s.category === 'set-intention'),
    };

    const selected: Suggestion[] = [];

    // 1. ALWAYS include critical suggestions (non-dismissible emergencies)
    selected.push(...buckets.critical);

    if (selected.length >= maxCount) {
        return selected.slice(0, maxCount);
    }

    // 2. Build a diverse set from different buckets
    // Priority order: reflect -> lifeEvent -> drift -> portfolio -> fresh/wildcards -> deepen -> maintain -> insight
    const bucketOrder: Array<keyof typeof buckets> = [
        'reflect', 'lifeEvent', 'drift', 'portfolio',
        'communityCheckin', 'wildcard', 'variety', 'gentleNudge', 'setIntention', // Moved UP for freshness
        'deepen', 'maintain', 'insight', 'dailyReflect'
    ];

    // Maintain a set of IDs to prevent duplicates (e.g. critical items picked again as category items)
    const selectedIds = new Set(selected.map(s => s.id));

    // Round-robin selection: pick best from each bucket
    for (const bucketName of bucketOrder) {
        if (selected.length >= maxCount) break;

        const bucket = buckets[bucketName];
        if (bucket.length === 0) continue;

        // Sort bucket by urgency, then pick the top one
        const sorted = bucket.sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));

        // Find the first candidate not already selected
        const candidate = sorted.find(s => !selectedIds.has(s.id));

        if (candidate) {
            selected.push(candidate);
            selectedIds.add(candidate.id);
        }
    }

    // 3. If we still have room, fill with highest urgency remaining
    if (selected.length < maxCount) {
        const remaining = workingSuggestions
            .filter(s => !selectedIds.has(s.id))
            .sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));

        while (selected.length < maxCount && remaining.length > 0) {
            selected.push(remaining.shift()!);
        }
    }

    // Final sort: critical first, then by original urgency
    return selected.sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));
}
