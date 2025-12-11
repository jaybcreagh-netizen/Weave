// src/modules/intelligence/services/social-season/season-scoring.service.ts
/**
 * Season-Aware Scoring Bonuses
 *
 * Social Seasons influence interaction scoring to align incentives:
 * - Resting: +20% bonus for ANY interaction (celebrating showing up despite low energy)
 * - Balanced: Normal scoring
 * - Blooming: +10% bonus for high-quality interactions (rated 4-5)
 *
 * Bonuses are additive only - we never penalize usage.
 */

import { SocialSeason } from '@/db/models/UserProfile';
import { Vibe } from '@/shared/types/common';

/**
 * Season scoring configuration
 */
export interface SeasonScoringConfig {
    /** Bonus multiplier for all interactions */
    baseBonus: number;
    /** Additional bonus for high-quality interactions (4-5 vibe rating) */
    qualityBonus: number;
    /** Description for UI */
    description: string;
}

/**
 * Season scoring configurations
 */
const SEASON_SCORING_CONFIGS: Record<SocialSeason, SeasonScoringConfig> = {
    resting: {
        baseBonus: 0.20,      // +20% for any interaction
        qualityBonus: 0,      // No extra quality bonus in resting (all effort is celebrated equally)
        description: '+20% bonus for every interaction',
    },
    balanced: {
        baseBonus: 0,         // No bonus
        qualityBonus: 0,      // No bonus
        description: 'Normal scoring',
    },
    blooming: {
        baseBonus: 0,         // No base bonus
        qualityBonus: 0.10,   // +10% for high-quality
        description: '+10% bonus for high-quality interactions',
    },
};

/**
 * Get the scoring configuration for a given season
 */
export function getSeasonScoringConfig(
    season: SocialSeason | null | undefined
): SeasonScoringConfig {
    const effectiveSeason: SocialSeason = season || 'balanced';
    return SEASON_SCORING_CONFIGS[effectiveSeason];
}

/**
 * Vibe ratings that count as "high quality" (FullMoon, WaxingGibbous = 4-5 stars equivalent)
 */
const HIGH_QUALITY_VIBES: Vibe[] = ['FullMoon', 'WaxingGibbous'];

/**
 * Check if a vibe rating counts as high quality
 */
export function isHighQualityVibe(vibe: Vibe | string | null | undefined): boolean {
    if (!vibe) return false;
    return HIGH_QUALITY_VIBES.includes(vibe as Vibe);
}

/**
 * Calculate the season scoring multiplier for an interaction
 *
 * @param season - Current social season
 * @param vibe - Optional vibe/quality rating of the interaction
 * @returns Multiplier to apply to base points (1.0 = no change, 1.2 = +20%)
 */
export function getSeasonScoringMultiplier(
    season: SocialSeason | null | undefined,
    vibe?: Vibe | string | null
): number {
    const config = getSeasonScoringConfig(season);

    // Start with base multiplier (1.0 = normal)
    let multiplier = 1.0;

    // Add base bonus (applies to ALL interactions in resting)
    multiplier += config.baseBonus;

    // Add quality bonus if applicable
    if (config.qualityBonus > 0 && isHighQualityVibe(vibe)) {
        multiplier += config.qualityBonus;
    }

    return multiplier;
}

/**
 * Apply season scoring bonus to base points
 *
 * @param basePoints - Points before season bonus
 * @param season - Current social season
 * @param vibe - Optional vibe/quality rating of the interaction
 * @returns Points after applying season bonus
 */
export function applySeasonScoringBonus(
    basePoints: number,
    season: SocialSeason | null | undefined,
    vibe?: Vibe | string | null
): number {
    const multiplier = getSeasonScoringMultiplier(season, vibe);
    return basePoints * multiplier;
}

/**
 * Get season-specific explanation of scoring for user
 */
export function getSeasonScoringExplanation(
    season: SocialSeason | null | undefined
): string {
    const effectiveSeason: SocialSeason = season || 'balanced';

    switch (effectiveSeason) {
        case 'resting':
            return 'Every interaction earns +20% bonus points while you rest. Any connection counts!';
        case 'blooming':
            return 'High-quality interactions earn +10% bonus. Channel your energy into meaningful connections.';
        case 'balanced':
        default:
            return 'Standard scoring for a balanced rhythm.';
    }
}
