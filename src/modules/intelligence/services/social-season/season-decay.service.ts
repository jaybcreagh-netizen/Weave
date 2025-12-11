// src/modules/intelligence/services/social-season/season-decay.service.ts
/**
 * Season-Aware Decay Multipliers
 *
 * Social Seasons influence decay rates to match user's current capacity:
 * - Resting: Slower decay (relationships "wait" for you)
 * - Balanced: Normal decay rates
 * - Blooming: Slightly faster decay for close ties (encourages channeling energy wisely)
 *
 * Multipliers are applied to the base tier decay rates.
 */

import { SocialSeason } from '@/db/models/UserProfile';
import { Tier } from '@/shared/types/common';

/**
 * Decay multipliers by season and tier
 *
 * Values < 1.0 = slower decay (relationships are more forgiving)
 * Values > 1.0 = faster decay (need more frequent contact)
 * Values = 1.0 = normal decay
 */
const SEASON_DECAY_MULTIPLIERS: Record<SocialSeason, Record<Tier, number>> = {
    resting: {
        InnerCircle: 0.7,   // 30% slower - close bonds wait for you
        CloseFriends: 0.75, // 25% slower
        Community: 0.8,     // 20% slower
    },
    balanced: {
        InnerCircle: 1.0,   // Normal
        CloseFriends: 1.0,
        Community: 1.0,
    },
    blooming: {
        InnerCircle: 1.2,   // 20% faster - channel abundant energy wisely
        CloseFriends: 1.15, // 15% faster
        Community: 1.0,     // Community stays normal (they're already low-maintenance)
    },
};

/**
 * Get the decay multiplier for a given season and tier
 *
 * @param season - Current social season
 * @param tier - Friend's Dunbar tier
 * @returns Multiplier to apply to base decay rate
 */
export function getSeasonDecayMultiplier(
    season: SocialSeason | null | undefined,
    tier: Tier | string
): number {
    // Default to balanced if no season
    const effectiveSeason: SocialSeason = season || 'balanced';

    // Validate tier, default to CloseFriends if invalid
    const validTiers: Tier[] = ['InnerCircle', 'CloseFriends', 'Community'];
    const effectiveTier: Tier = validTiers.includes(tier as Tier)
        ? (tier as Tier)
        : 'CloseFriends';

    return SEASON_DECAY_MULTIPLIERS[effectiveSeason][effectiveTier];
}

/**
 * Get all decay multipliers for current season (for display purposes)
 */
export function getSeasonDecayEffects(
    season: SocialSeason | null | undefined
): { tier: Tier; multiplier: number; description: string }[] {
    const effectiveSeason: SocialSeason = season || 'balanced';
    const multipliers = SEASON_DECAY_MULTIPLIERS[effectiveSeason];

    return [
        {
            tier: 'InnerCircle',
            multiplier: multipliers.InnerCircle,
            description: getMultiplierDescription(multipliers.InnerCircle),
        },
        {
            tier: 'CloseFriends',
            multiplier: multipliers.CloseFriends,
            description: getMultiplierDescription(multipliers.CloseFriends),
        },
        {
            tier: 'Community',
            multiplier: multipliers.Community,
            description: getMultiplierDescription(multipliers.Community),
        },
    ];
}

/**
 * Get human-readable description of multiplier effect
 */
function getMultiplierDescription(multiplier: number): string {
    if (multiplier < 1.0) {
        const percent = Math.round((1 - multiplier) * 100);
        return `${percent}% slower decay`;
    } else if (multiplier > 1.0) {
        const percent = Math.round((multiplier - 1) * 100);
        return `${percent}% faster decay`;
    }
    return 'Normal decay';
}

/**
 * Check if season provides decay relief (for UI messaging)
 */
export function seasonProvidesDecayRelief(
    season: SocialSeason | null | undefined
): boolean {
    return (season || 'balanced') === 'resting';
}

/**
 * Get season-specific decay explanation for user
 */
export function getSeasonDecayExplanation(
    season: SocialSeason | null | undefined
): string {
    const effectiveSeason: SocialSeason = season || 'balanced';

    switch (effectiveSeason) {
        case 'resting':
            return 'Your relationships are decaying slower while you rest. Take the time you need.';
        case 'blooming':
            return 'With your high energy, close ties need a bit more attention to stay strong.';
        case 'balanced':
        default:
            return 'Your relationship scores are decaying at their normal rate.';
    }
}
