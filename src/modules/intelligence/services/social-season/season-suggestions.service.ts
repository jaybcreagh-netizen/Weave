// src/modules/intelligence/services/social-season/season-suggestions.service.ts
/**
 * Season-Aware Suggestion Configuration
 *
 * Social Seasons influence the volume, type, and priority of suggestions:
 * - Resting: Reduce volume, only critical suggestions, prefer low-effort actions
 * - Balanced: Normal suggestion flow
 * - Blooming: Increase volume, include expansion suggestions, encourage high-impact
 *
 * Life events always bypass the daily cap.
 */

import { SocialSeason } from '@/db/models/UserProfile';
import { Suggestion } from '@/shared/types/common';

/**
 * Suggestion category for filtering purposes
 */
export type SuggestionCategory =
    | 'critical-drift'  // Critical inner circle drift
    | 'high-drift'      // High urgency drift
    | 'life-event'      // Birthday, anniversary, detected events
    | 'first-weave'     // New friend needs first interaction
    | 'intention-reminder'
    | 'archetype-mismatch'
    | 'momentum'        // Deepen while hot
    | 'maintain'        // Regular maintenance
    | 'deepen'          // Thriving relationship
    | 'reflect'         // Reflection needed
    | 'celebrate'       // Celebration opportunity
    | 'expansion'       // New connections (blooming only)
    | 'daily-reflect'   // Guaranteed daily reflection prompt
    | 'gentle-nudge'    // Low-pressure reach-out suggestion
    | 'wildcard'        // Spontaneous, serendipitous ideas
    | 'community-checkin' // Check in on community tier members
    | 'variety'         // Encourage connecting with different people
    | 'set-intention';  // Prompt to set an intention for a relationship

/**
 * Effort level for interaction types
 */
export type EffortLevel = 'low' | 'medium' | 'high';

/**
 * Season suggestion configuration
 */
export interface SeasonSuggestionConfig {
    /** Maximum suggestions per day (excluding bypass categories) */
    maxDaily: number;
    /** Categories allowed in this season */
    allowedCategories: SuggestionCategory[];
    /** Preferred effort level for suggested activities */
    preferredEffort: EffortLevel;
    /** Categories that bypass the daily cap */
    bypassCategories: SuggestionCategory[];
    /** Priority boost multiplier for this season (default 1.0) */
    priorityMultiplier: number;
}

/**
 * Season suggestion configurations
 */
const SEASON_SUGGESTION_CONFIGS: Record<SocialSeason, SeasonSuggestionConfig> = {
    resting: {
        maxDaily: 3, // Increased from 2 to ensure users always have options
        allowedCategories: [
            'critical-drift',
            'life-event',       // Always include life events
            'first-weave',      // Still encourage first contact with new friends
            'daily-reflect',    // Gentle reflection prompts always available
            'gentle-nudge',     // Low-pressure check-ins are appropriate during rest
            'wildcard',         // Light spontaneous ideas can still be shown
            'maintain',         // Allow maintenance for slightly overdue friends
            'community-checkin', // Check on community members
        ],
        preferredEffort: 'low',
        bypassCategories: ['life-event'], // Birthdays, anniversaries always shown
        priorityMultiplier: 0.7, // Less pressure overall
    },
    balanced: {
        maxDaily: 4,
        allowedCategories: [
            'critical-drift',
            'high-drift',
            'life-event',
            'first-weave',
            'intention-reminder',
            'archetype-mismatch',
            'momentum',
            'maintain',
            'deepen',
            'reflect',
            'celebrate',
            'daily-reflect',    // Guaranteed daily reflection
            'gentle-nudge',     // Low-pressure reach-out
            'wildcard',         // Spontaneous ideas
            'community-checkin', // Check on community members
            'variety',          // Encourage connecting with different people
            'set-intention',    // Prompt to set intentions
        ],
        preferredEffort: 'medium',
        bypassCategories: ['life-event'],
        priorityMultiplier: 1.0,
    },
    blooming: {
        maxDaily: 6,
        allowedCategories: [
            'critical-drift',
            'high-drift',
            'life-event',
            'first-weave',
            'intention-reminder',
            'archetype-mismatch',
            'momentum',
            'maintain',
            'deepen',
            'reflect',
            'celebrate',
            'expansion',        // Only in blooming: encourage new connections
            'daily-reflect',    // Guaranteed daily reflection
            'gentle-nudge',     // Low-pressure reach-out
            'wildcard',         // Spontaneous ideas
            'community-checkin', // Check on community members
            'variety',          // Encourage connecting with different people
            'set-intention',    // Prompt to set intentions
        ],
        preferredEffort: 'high',
        bypassCategories: ['life-event'],
        priorityMultiplier: 1.2, // More encouragement
    },
};

/**
 * Get the suggestion configuration for a given season
 */
export function getSeasonSuggestionConfig(
    season: SocialSeason | null | undefined
): SeasonSuggestionConfig {
    const effectiveSeason: SocialSeason = season || 'balanced';
    return SEASON_SUGGESTION_CONFIGS[effectiveSeason];
}

/**
 * Check if a suggestion category is allowed in the current season
 */
export function isSuggestionCategoryAllowed(
    season: SocialSeason | null | undefined,
    category: string | undefined
): boolean {
    if (!category) return true; // Allow if no category specified

    const config = getSeasonSuggestionConfig(season);
    return config.allowedCategories.includes(category as SuggestionCategory);
}

/**
 * Check if a suggestion category bypasses the daily cap
 */
export function doesSuggestionBypassCap(
    season: SocialSeason | null | undefined,
    category: string | undefined
): boolean {
    if (!category) return false;

    const config = getSeasonSuggestionConfig(season);
    return config.bypassCategories.includes(category as SuggestionCategory);
}

/**
 * Filter a list of suggestions based on the current season
 *
 * @param suggestions - Raw list of suggestions
 * @param season - Current social season
 * @returns Filtered and capped list of suggestions
 */
export function filterSuggestionsBySeason(
    suggestions: Suggestion[],
    season: SocialSeason | null | undefined
): Suggestion[] {
    const config = getSeasonSuggestionConfig(season);

    // Step 1: Filter by allowed categories
    const allowedSuggestions = suggestions.filter(s =>
        isSuggestionCategoryAllowed(season, s.category)
    );

    // Step 2: Separate bypass vs regular suggestions
    const bypassSuggestions = allowedSuggestions.filter(s =>
        doesSuggestionBypassCap(season, s.category)
    );

    const regularSuggestions = allowedSuggestions.filter(s =>
        !doesSuggestionBypassCap(season, s.category)
    );

    // Step 3: Sort regular suggestions by urgency/priority
    const urgencyOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };

    const sortedRegular = regularSuggestions.sort((a, b) => {
        const aUrgency = urgencyOrder[a.urgency || 'medium'];
        const bUrgency = urgencyOrder[b.urgency || 'medium'];
        return aUrgency - bUrgency;
    });

    // Step 4: Apply cap to regular suggestions only
    const cappedRegular = sortedRegular.slice(0, config.maxDaily);

    // Step 5: Combine bypass + capped regular, prioritize bypass
    return [...bypassSuggestions, ...cappedRegular];
}

/**
 * Get season-aware explanation for why suggestions are limited
 */
export function getSeasonSuggestionExplanation(
    season: SocialSeason | null | undefined
): string | null {
    const effectiveSeason: SocialSeason = season || 'balanced';

    switch (effectiveSeason) {
        case 'resting':
            return "We're showing fewer suggestions while you rest. Only important connections and life events will appear.";
        case 'blooming':
            return "With your high energy, we're showing more opportunities to deepen and expand your connections.";
        case 'balanced':
        default:
            return null; // No special explanation for balanced
    }
}

/**
 * Get the preferred interaction categories for a season
 * Used to pre-select lower-effort options in resting, higher-effort in blooming
 */
export function getSeasonPreferredCategories(
    season: SocialSeason | null | undefined
): string[] {
    const config = getSeasonSuggestionConfig(season);

    switch (config.preferredEffort) {
        case 'low':
            return ['text-call', 'voice-note']; // Quick, low-energy options
        case 'high':
            return ['deep-talk', 'activity-hobby', 'meal-drink', 'event-party']; // Meaningful, higher-effort
        case 'medium':
        default:
            return ['text-call', 'meal-drink', 'hangout']; // Balanced mix
    }
}
