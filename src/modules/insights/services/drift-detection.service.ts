/**
 * Drift Detection Service
 * Calculates which friends are "drifting" based on weave score decay.
 * Uses score-based approach rather than just days since last weave.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { differenceInDays } from 'date-fns';

// Score thresholds by tier (percentage of max score ~100)
// Lower scores = more urgently needs attention
export const DRIFT_THRESHOLDS = {
    InnerCircle: { warning: 40, alert: 20 },  // Inner friends decay faster, need more attention
    CloseFriends: { warning: 30, alert: 15 },
    Community: { warning: 20, alert: 10 },
} as const;

// Day-based thresholds for display purposes (when we have last weave date)
export const DAY_THRESHOLDS = {
    InnerCircle: { warning: 7, alert: 14 },
    CloseFriends: { warning: 14, alert: 21 },
    Community: { warning: 30, alert: 45 },
} as const;

export type DriftStatus = 'ok' | 'warning' | 'alert';

export interface DriftAlert {
    friendId: string;
    friendName: string;
    tier: 'InnerCircle' | 'CloseFriends' | 'Community';
    weaveScore: number;
    daysSinceWeave: number | null;
    status: 'warning' | 'alert';
    urgencyScore: number; // 0-100, higher = more urgent
}

/**
 * Calculate drift status based on weave score
 */
export function calculateDriftStatus(
    weaveScore: number,
    tier: 'InnerCircle' | 'CloseFriends' | 'Community'
): DriftStatus {
    const thresholds = DRIFT_THRESHOLDS[tier];

    if (weaveScore <= thresholds.alert) {
        return 'alert';
    }
    if (weaveScore <= thresholds.warning) {
        return 'warning';
    }
    return 'ok';
}

/**
 * Calculate urgency score (0-100, higher = more urgent)
 * Takes into account tier importance and score decay
 */
function calculateUrgencyScore(
    weaveScore: number,
    tier: 'InnerCircle' | 'CloseFriends' | 'Community'
): number {
    // Tier weights: Inner Circle matters most
    const tierWeight = {
        InnerCircle: 1.5,
        CloseFriends: 1.2,
        Community: 1.0,
    };

    // Invert weave score (lower score = higher urgency)
    // and apply tier weight
    const baseUrgency = Math.max(0, 100 - weaveScore);
    const weightedUrgency = baseUrgency * tierWeight[tier];

    return Math.min(100, weightedUrgency);
}

/**
 * Get days since last weave from friend's lastUpdated field
 */
function getDaysSinceLastUpdate(lastUpdated: Date | null): number | null {
    if (!lastUpdated) return null;
    return differenceInDays(new Date(), lastUpdated);
}

/**
 * Get all friends who are currently in warning or alert drift status
 * Uses weave score (which already includes decay) for smarter detection
 */
export async function getDriftAlerts(): Promise<DriftAlert[]> {
    try {
        // Get all friends (excluding dormant) with low weave scores
        // Only include friends who have been interacted with (weaveScore > 0 or has been updated)
        const friends = await database
            .get<FriendModel>('friends')
            .query(
                Q.where('is_dormant', Q.notEq(true)),
                Q.sortBy('weave_score', Q.asc) // Lowest scores first (most urgent)
            )
            .fetch();

        const alerts: DriftAlert[] = [];

        for (const friend of friends) {
            const tier = friend.tier as 'InnerCircle' | 'CloseFriends' | 'Community';

            // Only process known tiers
            if (!DRIFT_THRESHOLDS[tier]) {
                continue;
            }

            const weaveScore = friend.weaveScore || 0;
            const status = calculateDriftStatus(weaveScore, tier);

            // Only include friends who are actually drifting
            if (status === 'warning' || status === 'alert') {
                // Skip friends who have never been weaved with (score is 0 and never updated)
                // These are likely new friends who haven't had any interactions yet
                const hasBeenWeavedWith = weaveScore > 0 || (friend.lastUpdated && friend.lastUpdated.getTime() > friend.createdAt.getTime());

                if (!hasBeenWeavedWith) {
                    continue;
                }

                const daysSince = getDaysSinceLastUpdate(friend.lastUpdated);
                const urgencyScore = calculateUrgencyScore(weaveScore, tier);

                alerts.push({
                    friendId: friend.id,
                    friendName: friend.name,
                    tier,
                    weaveScore,
                    daysSinceWeave: daysSince,
                    status,
                    urgencyScore,
                });
            }
        }

        // Sort by urgency score (highest first = most urgent)
        alerts.sort((a, b) => b.urgencyScore - a.urgencyScore);

        // Limit to top 10 most urgent (avoid overwhelming the user)
        return alerts.slice(0, 10);
    } catch (error) {
        console.error('[DriftDetection] Error getting drift alerts:', error);
        return [];
    }
}

/**
 * Get drift alerts grouped by tier
 */
export async function getDriftAlertsByTier(): Promise<{
    innerCircle: DriftAlert[];
    closeFriends: DriftAlert[];
    community: DriftAlert[];
}> {
    const alerts = await getDriftAlerts();

    return {
        innerCircle: alerts.filter((a) => a.tier === 'InnerCircle'),
        closeFriends: alerts.filter((a) => a.tier === 'CloseFriends'),
        community: alerts.filter((a) => a.tier === 'Community'),
    };
}

/**
 * Get count of friends currently drifting
 */
export async function getDriftCount(): Promise<{ warning: number; alert: number; total: number }> {
    const alerts = await getDriftAlerts();

    const warning = alerts.filter((a) => a.status === 'warning').length;
    const alert = alerts.filter((a) => a.status === 'alert').length;

    return { warning, alert, total: alerts.length };
}
