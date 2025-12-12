// src/modules/notifications/services/season-notifications.service.ts

/**
 * Season-Aware Notification Throttling
 *
 * Implements the policy for notification frequency and type based on Social Season.
 *
 * Policies:
 * - Resting: Reduce frequency by 60%, suppress non-critical
 * - Balanced: Standard limits
 * - Blooming: Increased frequency, broader types
 */

import { SocialSeason } from '@/db/models/UserProfile';
import { NotificationType } from '../types';
import { SuggestionCategory } from '@/modules/intelligence';

export interface SeasonNotificationConfig {
    /** Multiplier for max daily notifications (0.4 = 60% reduction) */
    frequencyMultiplier: number;
    /** Whether to suppress standard nudges (keep only critical) */
    suppressStandardNudges: boolean;
    /** Allowed suggestion categories for push notifications */
    allowedCategories: (SuggestionCategory | 'all')[];
    /** Minimum hours between notifications override */
    minIntervalOverride?: number;
}

const SEASON_NOTIFICATION_CONFIGS: Record<SocialSeason, SeasonNotificationConfig> = {
    resting: {
        frequencyMultiplier: 0.4, // 60% reduction
        suppressStandardNudges: true,
        allowedCategories: ['critical-drift', 'life-event'], // Only critical
        minIntervalOverride: 4, // Slower pacing
    },
    balanced: {
        frequencyMultiplier: 1.0,
        suppressStandardNudges: false,
        allowedCategories: ['all'], // Wildcard for all
    },
    blooming: {
        frequencyMultiplier: 1.5, // 50% more frequent
        suppressStandardNudges: false,
        allowedCategories: ['all'],
        minIntervalOverride: 1.5, // Faster pacing
    },
};

/**
 * Get notification configuration for a season
 */
export function getSeasonNotificationConfig(season: SocialSeason | null | undefined): SeasonNotificationConfig {
    const effectiveSeason = season || 'balanced';
    return SEASON_NOTIFICATION_CONFIGS[effectiveSeason];
}

/**
 * Check if a specific notification type/category should be sent effectively immediately (push)
 * vs suppressed/batched in the current season.
 */
export function shouldSendNotification(
    season: SocialSeason | null | undefined,
    type: NotificationType,
    category?: SuggestionCategory,
    urgency?: 'critical' | 'high' | 'medium' | 'low'
): boolean {
    const config = getSeasonNotificationConfig(season);

    // Critical items always go through
    if (urgency === 'critical') return true;
    if (category === 'life-event') return true;
    if (type === 'life-event') return true;
    if (type === 'weekly-reflection') return true; // Always allow ritual

    // Resting suppression
    if (config.suppressStandardNudges) {
        if (type === 'friend-suggestion' || type === 'deepening-nudge' || type === 'memory-nudge') {
            // Allow if explicit category match (e.g. critical-drift)
            if (category && config.allowedCategories.includes(category)) return true;
            return false;
        }
    }

    return true;
}

/**
 * Apply season multiplier to daily limit
 */
export function applySeasonLimit(
    baseLimit: number,
    season: SocialSeason | null | undefined
): number {
    const config = getSeasonNotificationConfig(season);
    // Ensure at least 1 if base > 0, unless multiplier is 0
    if (baseLimit <= 0) return 0;
    return Math.max(1, Math.round(baseLimit * config.frequencyMultiplier));
}
