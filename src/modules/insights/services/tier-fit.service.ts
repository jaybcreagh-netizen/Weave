// src/modules/insights/services/tier-fit.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { Tier } from '@/shared/types/core';
import type {
  TierFitAnalysis,
  TierFitCategory,
  NetworkTierHealth,
  TierHealth
} from '../types';
import {
  analyzeInteractionPattern,
  type PatternInteractionData
} from './pattern.service';

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
const MINIMUM_SAMPLE_SIZE = 2;
const CONFIDENT_SAMPLE_SIZE = 5;

/**
 * Fetch interactions for a friend and convert to PatternInteractionData format.
 * Filters to primary interactions (small groups) for more accurate personal rhythm.
 *
 * @param friendId - The friend to fetch interactions for
 * @returns Array of PatternInteractionData for pattern analysis
 */
async function fetchInteractionsForPattern(friendId: string): Promise<PatternInteractionData[]> {
  // Get all interaction links for this friend
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);

  if (interactionIds.length === 0) {
    return [];
  }

  // Fetch completed interactions from last 180 days for better pattern detection
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed'),
      Q.where('interaction_date', Q.gte(sixMonthsAgo)),
      Q.sortBy('interaction_date', Q.desc)
    )
    .fetch();

  // For each interaction, count how many friends were involved
  // This helps filter out large group events
  const interactionWithCounts: PatternInteractionData[] = await Promise.all(
    interactions.map(async (interaction) => {
      const friendLinks = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interaction.id))
        .fetchCount();

      return {
        id: interaction.id,
        interactionDate: interaction.interactionDate,
        status: interaction.status,
        category: interaction.interactionCategory,
        friendCount: friendLinks
      };
    })
  );

  return interactionWithCounts;
}

/**
 * Analyze how well a friend's actual interaction pattern matches their tier.
 * Uses simple interval comparison for clear, actionable results.
 *
 * @param friend - The friend to analyze
 * @returns Tier fit analysis with suggestions
 */
export async function analyzeTierFit(friend: Friend): Promise<TierFitAnalysis> {
  const expectedInterval = TIER_EXPECTED_INTERVALS[friend.dunbarTier as Tier];

  // Try to use cached value, otherwise calculate on-the-fly
  let actualInterval = friend.typicalIntervalDays;
  let interactionCount = friend.ratedWeavesCount;

  // If no cached interval, calculate from interactions
  if (!actualInterval || actualInterval === 0) {
    const interactions = await fetchInteractionsForPattern(friend.id);

    if (interactions.length >= MINIMUM_SAMPLE_SIZE) {
      // Calculate pattern with primaryOnly filter to focus on personal interactions
      const pattern = analyzeInteractionPattern(interactions, {
        primaryOnly: true,
        primaryMaxFriends: 3
      });

      actualInterval = pattern.averageIntervalDays;
      interactionCount = pattern.sampleSize;

      // If primary-only has too few interactions, fall back to all interactions
      if (pattern.sampleSize < MINIMUM_SAMPLE_SIZE) {
        const allPattern = analyzeInteractionPattern(interactions);
        actualInterval = allPattern.averageIntervalDays;
        interactionCount = allPattern.sampleSize;
      }
    }
  }

  // Still no valid interval? Return learning state
  if (!actualInterval || actualInterval === 0 || interactionCount < MINIMUM_SAMPLE_SIZE) {
    return {
      friendId: friend.id,
      friendName: friend.name,
      currentTier: friend.dunbarTier as Tier,
      actualIntervalDays: 0,
      expectedIntervalDays: expectedInterval,
      interactionCount: interactionCount,
      fitScore: 0,
      fitCategory: 'learning',
      confidence: 0,
      reason: 'Keep weaving to learn your rhythm (need at least 2 interactions)',
      isPreliminary: true
    };
  }

  const isPreliminary = interactionCount < CONFIDENT_SAMPLE_SIZE;

  // Simple interval comparison
  const deviationRatio = actualInterval / expectedInterval;

  let fitCategory: TierFitCategory;
  let suggestedTier: Tier | undefined;
  let reason = '';

  // Simple thresholds:
  // - Under 0.5x = connecting much MORE than expected (promote candidate)
  // - 0.5x to 1.5x = aligned (within reasonable range)
  // - Over 2.0x = connecting much LESS than expected (demote candidate)
  // - 1.5x to 2.0x = slightly off but not actionable

  if (deviationRatio < 0.5) {
    // Connecting MORE than tier expects
    fitCategory = 'over_investing';

    // Suggest promotion (except Inner Circle - can't go higher)
    if (friend.dunbarTier === 'Community') {
      suggestedTier = 'CloseFriends';
      reason = `You connect every ${Math.round(actualInterval)} days—more frequently than Community expects (~${expectedInterval} days). This looks like Close Friends frequency!`;
    } else if (friend.dunbarTier === 'CloseFriends') {
      suggestedTier = 'InnerCircle';
      reason = `You connect every ${Math.round(actualInterval)} days—weekly or more! This is Inner Circle frequency. Consider promoting this friendship.`;
    } else {
      // Inner Circle - can't promote, but that's great
      fitCategory = 'aligned';
      reason = `Strong bond! You connect every ${Math.round(actualInterval)} days, even more than Inner Circle expects.`;
    }
  } else if (deviationRatio > 2.0) {
    // Connecting LESS than tier expects
    fitCategory = 'under_investing';

    // Suggest demotion (except Community - can't go lower)
    if (friend.dunbarTier === 'InnerCircle') {
      suggestedTier = 'CloseFriends';
      reason = `You connect every ${Math.round(actualInterval)} days, but Inner Circle expects weekly (~${expectedInterval} days). Close Friends might be a better fit.`;
    } else if (friend.dunbarTier === 'CloseFriends') {
      suggestedTier = 'Community';
      reason = `You connect every ${Math.round(actualInterval)} days, but Close Friends expects bi-weekly (~${expectedInterval} days). Community might feel more natural.`;
    } else {
      // Community with very low contact - still flag it
      reason = `You connect every ${Math.round(actualInterval)} days. Even for Community that's quite infrequent.`;
    }
  } else {
    // Within reasonable range (0.5x to 2.0x) - aligned
    fitCategory = 'aligned';
    reason = `Your rhythm (every ${Math.round(actualInterval)} days) matches ${friend.dunbarTier} expectations (~${expectedInterval} days).`;
  }

  // Confidence based on sample size (keep this logic)
  const confidence = Math.min(
    0.95,
    0.5 + (interactionCount / 20) * 0.45
  );

  // Simple fit score: 1.0 if aligned, lower based on deviation
  const fitScore = fitCategory === 'aligned'
    ? 1.0
    : Math.max(0.2, 1 - Math.abs(deviationRatio - 1) / 3);

  return {
    friendId: friend.id,
    friendName: friend.name,
    currentTier: friend.dunbarTier as Tier,
    actualIntervalDays: actualInterval,
    expectedIntervalDays: expectedInterval,
    interactionCount: interactionCount,
    fitScore,
    fitCategory,
    suggestedTier,
    confidence,
    reason,
    isPreliminary
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

  // Analyze each friend (now async)
  const analyses = await Promise.all(friends.map(friend => analyzeTierFit(friend)));

  // Initialize tier health buckets
  const tierHealth: NetworkTierHealth['tierHealth'] = {
    InnerCircle: { total: 0, aligned: 0, misaligned: 0 },
    CloseFriends: { total: 0, aligned: 0, misaligned: 0 },
    Community: { total: 0, aligned: 0, misaligned: 0 }
  };

  // Categorize each friend
  analyses.forEach(analysis => {
    const tier = analysis.currentTier;

    // Always count towards total in tier
    tierHealth[tier].total++;

    if (analysis.fitCategory === 'learning') return;

    if (analysis.fitCategory === 'aligned') {
      tierHealth[tier].aligned++;
    } else {
      // over_investing or under_investing
      tierHealth[tier].misaligned++;
    }
  });

  // Calculate overall health score (0-10)
  // We include insufficient_data friends in the denominator to represent "potential"
  const totalFriends = analyses.length;

  const totalMisaligned =
    tierHealth.InnerCircle.misaligned +
    tierHealth.CloseFriends.misaligned +
    tierHealth.Community.misaligned;

  // Health score penalizes misaligned friends against the TOTAL network size
  const healthScore = totalFriends > 0
    ? Math.round(((totalFriends - totalMisaligned) / totalFriends) * 10)
    : 10;

  // Extract misaligned friends and suggestions
  const mismatches = analyses.filter(a => a.fitCategory === 'over_investing' || a.fitCategory === 'under_investing');
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
  if (analysis.fitCategory === 'learning') {
    return 'Keep weaving to learn your rhythm';
  }

  if (analysis.fitCategory === 'aligned') {
    return '✓ Tier matches your rhythm';
  }

  if (analysis.fitCategory === 'over_investing') {
    return '⬆️ Connecting more than tier expects';
  }

  // under_investing
  return '⚠️ Connecting less than tier expects';
}
