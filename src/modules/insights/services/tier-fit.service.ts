// src/modules/insights/services/tier-fit.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { Tier } from '@/shared/types/core';
import type {
  TierFitAnalysis,
  TierFitCategory,
  NetworkTierHealth,
  TierHealth
} from '../types';

/**
 * Expected interaction intervals per tier (in days)
 */
const TIER_EXPECTED_INTERVALS: Record<Tier, number> = {
  InnerCircle: 7,
  CloseFriends: 14,
  Community: 28
};

/**
 * Minimum sample size to provide tier fit analysis
 */
const MINIMUM_SAMPLE_SIZE = 5;

/**
 * Analyze how well a friend's actual interaction pattern matches their tier
 *
 * @param friend - The friend to analyze
 * @returns Tier fit analysis with suggestions
 */
export function analyzeTierFit(friend: Friend): TierFitAnalysis {
  const expectedInterval = TIER_EXPECTED_INTERVALS[friend.dunbarTier as Tier];
  const actualInterval = friend.typicalIntervalDays;

  // Need sufficient data (5+ interactions)
  if (!actualInterval || friend.ratedWeavesCount < MINIMUM_SAMPLE_SIZE) {
    return {
      friendId: friend.id,
      friendName: friend.name,
      currentTier: friend.dunbarTier as Tier,
      actualIntervalDays: 0,
      expectedIntervalDays: expectedInterval,
      interactionCount: friend.ratedWeavesCount,
      fitScore: 0,
      fitCategory: 'insufficient_data',
      confidence: 0,
      reason: 'Not enough interaction history yet (need at least 5 interactions)'
    };
  }

  // Calculate deviation ratio
  const deviationRatio = actualInterval / expectedInterval;

  // Score fit (inverse of deviation, clamped)
  let fitScore: number;
  let fitCategory: TierFitCategory;

  if (deviationRatio >= 0.7 && deviationRatio <= 1.3) {
    // Within 30% - great fit
    fitScore = 1.0;
    fitCategory = 'great';
  } else if (deviationRatio >= 0.5 && deviationRatio <= 2.0) {
    // Within 2x - good fit
    fitScore = 0.7;
    fitCategory = 'good';
  } else {
    // Beyond 2x - mismatch

    // EXCEPTION: For Inner Circle, being "too frequent" is actually good!
    // If you see your best friend every day (ratio ~0.14), that's a GREAT fit, not a mismatch.
    if (friend.dunbarTier === 'InnerCircle' && deviationRatio < 0.5) {
      fitScore = 1.0;
      fitCategory = 'great';
    } else {
      fitScore = Math.max(0, 1 - Math.abs(Math.log2(deviationRatio)) / 2);
      fitCategory = 'mismatch';
    }
  }

  // Generate suggestion if mismatch
  let suggestedTier: Tier | undefined;
  let reason = '';

  if (fitCategory === 'mismatch') {
    if (deviationRatio > 2.0) {
      // Too infrequent for current tier - suggest move down
      if (friend.dunbarTier === 'InnerCircle') {
        suggestedTier = 'CloseFriends';
        reason = `You connect every ${Math.round(actualInterval)} days, but Inner Circle expects weekly contact (~7 days). Close Friends (bi-weekly, ~14 days) would be a better fit and reduce stress.`;
      } else if (friend.dunbarTier === 'CloseFriends') {
        suggestedTier = 'Community';
        reason = `You connect every ${Math.round(actualInterval)} days, but Close Friends expects bi-weekly contact (~14 days). Community (monthly, ~28 days) would be a better fit.`;
      }
      // Community has nowhere to move down
    } else if (deviationRatio < 0.5) {
      // Too frequent for current tier - suggest move up
      if (friend.dunbarTier === 'Community') {
        suggestedTier = 'CloseFriends';
        reason = `You're connecting every ${Math.round(actualInterval)} days—more frequently than Community expects (~28 days)! This friendship might belong in Close Friends.`;
      } else if (friend.dunbarTier === 'CloseFriends') {
        suggestedTier = 'InnerCircle';
        reason = `You're connecting every ${Math.round(actualInterval)} days—weekly or more! This is Inner Circle frequency. Consider promoting this friendship.`;
      }
      // Inner Circle has nowhere to move up
    }
  } else if (fitCategory === 'great') {
    if (friend.dunbarTier === 'InnerCircle' && deviationRatio < 0.5) {
      reason = `Strong bond! You're connecting every ${Math.round(actualInterval)} days, which is even more frequent than the weekly expectation.`;
    } else {
      reason = `Perfect fit! Your rhythm (every ${Math.round(actualInterval)} days) matches ${friend.dunbarTier} expectations well.`;
    }
  } else {
    reason = `Good fit. Your rhythm (every ${Math.round(actualInterval)} days) is close to ${friend.dunbarTier} expectations (~${expectedInterval} days).`;
  }

  // Confidence based on sample size and consistency
  // More interactions = higher confidence
  const confidence = Math.min(
    0.95,
    0.5 + (friend.ratedWeavesCount / 20) * 0.45
  );

  return {
    friendId: friend.id,
    friendName: friend.name,
    currentTier: friend.dunbarTier as Tier,
    actualIntervalDays: actualInterval,
    expectedIntervalDays: expectedInterval,
    interactionCount: friend.ratedWeavesCount,
    fitScore,
    fitCategory,
    suggestedTier,
    confidence,
    reason
  };
}

/**
 * Analyze tier health across the entire network
 *
 * @returns Network-wide tier health analysis with suggestions
 */
export async function analyzeNetworkTierHealth(): Promise<NetworkTierHealth> {
  // Fetch all non-dormant friends
  const friends = await database
    .get<Friend>('friends')
    .query(Q.where('is_dormant', false))
    .fetch();

  // Analyze each friend
  const analyses = friends.map(analyzeTierFit);

  // Initialize tier health buckets
  const tierHealth: NetworkTierHealth['tierHealth'] = {
    InnerCircle: { total: 0, great: 0, good: 0, mismatch: 0 },
    CloseFriends: { total: 0, great: 0, good: 0, mismatch: 0 },
    Community: { total: 0, great: 0, good: 0, mismatch: 0 }
  };

  // Categorize each friend
  analyses.forEach(analysis => {
    const tier = analysis.currentTier;

    // Always count towards total in tier
    tierHealth[tier].total++;

    if (analysis.fitCategory === 'insufficient_data') return;

    if (analysis.fitCategory === 'great') {
      tierHealth[tier].great++;
    } else if (analysis.fitCategory === 'good') {
      tierHealth[tier].good++;
    } else {
      tierHealth[tier].mismatch++;
    }
  });

  // Calculate overall health score (0-10)
  // We include insufficient_data friends in the denominator to represent "potential"
  const totalFriends = analyses.length;

  const totalMismatches =
    tierHealth.InnerCircle.mismatch +
    tierHealth.CloseFriends.mismatch +
    tierHealth.Community.mismatch;

  // Health score penalizes mismatches against the TOTAL network size
  const healthScore = totalFriends > 0
    ? Math.round(((totalFriends - totalMismatches) / totalFriends) * 10)
    : 10;

  // Extract mismatches and suggestions
  const mismatches = analyses.filter(a => a.fitCategory === 'mismatch');
  const suggestions = analyses
    .filter(a => a.suggestedTier !== undefined)
    .sort((a, b) => {
      // Sort by confidence (higher first), then by deviation severity
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return Math.abs(b.actualIntervalDays / b.expectedIntervalDays) -
        Math.abs(a.actualIntervalDays / a.expectedIntervalDays);
    })
    .slice(0, 5); // Top 5 suggestions

  return {
    healthScore,
    tierHealth,
    mismatches,
    suggestions,
    allAnalyses: analyses
  };
}

/**
 * Check if a friend's tier suggestion should be shown
 * (not dismissed recently)
 *
 * @param friend - The friend to check
 * @param daysSinceDismissal - Min days before showing again (default: 90)
 * @returns Whether to show the suggestion
 */
export function shouldShowTierSuggestion(
  friend: Friend,
  daysSinceDismissal: number = 90
): boolean {
  if (!friend.tierSuggestionDismissedAt) {
    return true; // Never dismissed
  }

  const daysSince =
    (Date.now() - friend.tierSuggestionDismissedAt) / (1000 * 60 * 60 * 24);

  return daysSince >= daysSinceDismissal;
}

/**
 * Get a human-readable tier fit summary
 */
export function getTierFitSummary(analysis: TierFitAnalysis): string {
  if (analysis.fitCategory === 'insufficient_data') {
    return 'Keep weaving to learn your rhythm';
  }

  const deviation = analysis.actualIntervalDays / analysis.expectedIntervalDays;

  if (analysis.fitCategory === 'great') {
    return '✓ Tier matches your rhythm';
  }

  if (analysis.fitCategory === 'good') {
    return '~ Close to tier expectations';
  }

  // Mismatch
  if (deviation > 2.0) {
    return '⚠️ Connecting less than tier expects';
  } else {
    return '⬆️ Connecting more than tier expects';
  }
}
