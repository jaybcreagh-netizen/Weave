// src/modules/insights/services/tier-suggestion-engine.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import { analyzeTierFit, shouldShowTierSuggestion } from './tier-fit.service';
import { TierMigrationConfig } from '@/modules/intelligence/constants';
import type { TierFitAnalysis } from '../types';
import { Tier } from '@/shared/types/common';

/**
 * Conditions that trigger tier suggestions
 */
export enum TierSuggestionTrigger {
  AfterInteraction = 'after_interaction',
  RepeatedRedFriend = 'repeated_red_friend',
  PatternEstablished = 'pattern_established',
  NetworkHealthLow = 'network_health_low',
  ProlongedMismatch = 'prolonged_mismatch',       // NEW: 30+ days of mismatch
  UpwardMigration = 'upward_migration',           // NEW: Friend connecting more than tier expects
  DramaticMismatch = 'dramatic_mismatch'          // NEW: 60+ days severe mismatch
}

export interface TierSuggestionContext {
  trigger: TierSuggestionTrigger;
  analysis: TierFitAnalysis;
  urgency: 'high' | 'medium' | 'low';
  message: string;
  /** Whether this is a soft suggestion (non-intrusive) */
  isSoftSuggestion?: boolean;
  /** Direction of suggested migration */
  direction?: 'up' | 'down';
  /** Days the mismatch has persisted */
  mismatchDurationDays?: number;
}

/**
 * Check if tier suggestion should be shown after logging an interaction
 * Only shows if pattern has changed and now shows clear mismatch
 *
 * @param friendId - Friend who was just interacted with
 * @param wasFirstInteraction - Whether this was the first interaction
 * @returns Tier suggestion context if should show, null otherwise
 */
export async function checkTierSuggestionAfterInteraction(
  friendId: string,
  wasFirstInteraction: boolean = false
): Promise<TierSuggestionContext | null> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);

    // Don't suggest on first interaction - need pattern first
    if (wasFirstInteraction || friend.ratedWeavesCount < 5) {
      return null;
    }

    // Check if suggestion was recently dismissed
    if (!shouldShowTierSuggestion(friend, 90)) {
      return null;
    }

    // Analyze tier fit (now async)
    const analysis = await analyzeTierFit(friend);

    // Only show if clear mismatch
    if (analysis.fitCategory !== 'mismatch' || !analysis.suggestedTier) {
      return null;
    }

    // Check if pattern just became established (5th, 10th, 15th interaction)
    const milestones = [5, 10, 15];
    const isPatternMilestone = milestones.includes(friend.ratedWeavesCount);

    if (isPatternMilestone) {
      return {
        trigger: TierSuggestionTrigger.PatternEstablished,
        analysis,
        urgency: 'medium',
        message: `After ${friend.ratedWeavesCount} interactions, we've learned your rhythm with ${friend.name}!`
      };
    }

    // Otherwise, don't show after every interaction - too noisy
    return null;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error checking after interaction:', error);
    return null;
  }
}

/**
 * Check if friend has repeatedly gone red (low score)
 * This indicates tier expectations are too high
 *
 * @param friendId - Friend to check
 * @returns Tier suggestion context if should show, null otherwise
 */
export async function checkRepeatedRedFriend(
  friendId: string
): Promise<TierSuggestionContext | null> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);

    // Check if friend is currently in red zone (score < 40)
    if (friend.weaveScore >= 40) {
      return null;
    }

    // Check if suggestion was recently dismissed
    if (!shouldShowTierSuggestion(friend, 90)) {
      return null;
    }

    // Count how many times they've been in red zone recently
    // We approximate this by checking if they've had multiple interactions
    // but score is still low
    // 1. Get interaction IDs from join table
    const links = await database
      .get('interaction_friends')
      .query(Q.where('friend_id', friend.id))
      .fetch();
    const interactionIds = links.map((link: any) => link.interactionId);

    if (interactionIds.length === 0) return null;

    // 2. Fetch interactions
    const recentInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('id', Q.oneOf(interactionIds)),
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
        Q.sortBy('interaction_date', Q.desc)
      )
      .fetch();

    // If they've had 3+ interactions in last 30 days but score is still low,
    // tier expectations might be too high
    if (recentInteractions.length < 3) {
      return null;
    }

    // Analyze tier fit (now async)
    const analysis = await analyzeTierFit(friend);

    if (analysis.fitCategory !== 'mismatch' || !analysis.suggestedTier) {
      return null;
    }

    // Only suggest tier reduction (not promotion)
    const isReduction =
      (friend.dunbarTier === 'InnerCircle' && analysis.suggestedTier === 'CloseFriends') ||
      (friend.dunbarTier === 'CloseFriends' && analysis.suggestedTier === 'Community');

    if (!isReduction) {
      return null;
    }

    return {
      trigger: TierSuggestionTrigger.RepeatedRedFriend,
      analysis,
      urgency: 'high',
      message: `${friend.name} keeps needing attention despite your efforts. The tier might be too demanding.`
    };
  } catch (error) {
    console.error('[TierSuggestionEngine] Error checking repeated red:', error);
    return null;
  }
}

/**
 * Get all active tier suggestions for a user
 * Used for dashboard widgets and notifications
 *
 * @returns Array of tier suggestion contexts
 */
export async function getActiveTierSuggestions(): Promise<TierSuggestionContext[]> {
  try {
    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    const suggestions: TierSuggestionContext[] = [];

    for (const friend of friends) {
      // Skip if recently dismissed
      if (!shouldShowTierSuggestion(friend, 90)) {
        continue;
      }

      // Analyze tier fit (now async)
      const analysis = await analyzeTierFit(friend);

      if (analysis.fitCategory === 'mismatch' && analysis.suggestedTier) {
        // Check if this is a repeated red friend (high urgency)
        const redSuggestion = await checkRepeatedRedFriend(friend.id);

        if (redSuggestion) {
          suggestions.push(redSuggestion);
        } else {
          // Regular mismatch (medium urgency)
          suggestions.push({
            trigger: TierSuggestionTrigger.PatternEstablished,
            analysis,
            urgency: 'medium',
            message: `${friend.name}'s tier doesn't match your rhythm`
          });
        }
      }
    }

    // Sort by urgency and confidence
    suggestions.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      return b.analysis.confidence - a.analysis.confidence;
    });

    return suggestions;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error getting active suggestions:', error);
    return [];
  }
}

/**
 * Check if network health is low and needs rebalancing
 * Returns true if multiple friends have tier mismatches
 *
 * @returns Whether to prompt for network rebalancing
 */
export async function shouldPromptNetworkRebalancing(): Promise<boolean> {
  try {
    const suggestions = await getActiveTierSuggestions();

    // Prompt if 3+ friends have tier mismatches
    return suggestions.length >= 3;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error checking network health:', error);
    return false;
  }
}

/**
 * Calculates how long a friend has had a tier mismatch.
 * Uses tierFitLastCalculated to track when we first detected the mismatch.
 *
 * @param friend - The friend to check
 * @returns Number of days in mismatch state, or 0 if not in mismatch
 */
function calculateMismatchDuration(friend: Friend): number {
  if (!friend.tierFitLastCalculated) {
    return 0;
  }

  // tierFitLastCalculated is updated when fit score changes significantly
  // If current fit score is below threshold, this represents mismatch duration
  if ((friend.tierFitScore || 1.0) < TierMigrationConfig.mismatchThreshold) {
    const daysSinceLastCalculation = (Date.now() - friend.tierFitLastCalculated) / (1000 * 60 * 60 * 24);
    return Math.floor(daysSinceLastCalculation);
  }

  return 0;
}

/**
 * Determines the migration direction based on actual vs expected interaction patterns.
 *
 * @param analysis - The tier fit analysis
 * @returns 'up' for promotion, 'down' for demotion, or null if no migration needed
 */
function determineMigrationDirection(analysis: TierFitAnalysis): 'up' | 'down' | null {
  if (analysis.fitCategory !== 'mismatch' || !analysis.suggestedTier) {
    return null;
  }

  const deviationRatio = analysis.actualIntervalDays / analysis.expectedIntervalDays;

  // Connecting more frequently than expected = potential promotion
  if (deviationRatio < TierMigrationConfig.upwardMigrationRatio) {
    return 'up';
  }

  // Connecting less frequently than expected = potential demotion
  if (deviationRatio > TierMigrationConfig.downwardMigrationRatio) {
    return 'down';
  }

  return null;
}

/**
 * Gets the next tier up for promotion
 */
function getNextTierUp(currentTier: Tier): Tier | null {
  const tierOrder: Tier[] = ['Community', 'CloseFriends', 'InnerCircle'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
}

/**
 * Gets the next tier down for demotion
 */
function getNextTierDown(currentTier: Tier): Tier | null {
  const tierOrder: Tier[] = ['Community', 'CloseFriends', 'InnerCircle'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex > 0) {
    return tierOrder[currentIndex - 1];
  }
  return null;
}

/**
 * Detects upward migration opportunities - friends connecting more frequently
 * than their current tier expects, suggesting they should be promoted.
 *
 * @param friendId - Friend to check for upward migration
 * @returns Tier suggestion context if promotion is warranted, null otherwise
 */
export async function detectUpwardMigration(
  friendId: string
): Promise<TierSuggestionContext | null> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);

    // Can't promote from Inner Circle
    if (friend.dunbarTier === 'InnerCircle') {
      return null;
    }

    // Need enough interaction history
    if ((friend.ratedWeavesCount || 0) < TierMigrationConfig.minInteractionsForSuggestion) {
      return null;
    }

    // Check if suggestion was recently dismissed
    if (!shouldShowTierSuggestion(friend, TierMigrationConfig.dismissalCooldownDays)) {
      return null;
    }

    const analysis = await analyzeTierFit(friend);

    // Check for upward migration pattern
    const direction = determineMigrationDirection(analysis);
    if (direction !== 'up') {
      return null;
    }

    const suggestedTier = getNextTierUp(friend.dunbarTier as Tier);
    if (!suggestedTier) {
      return null;
    }

    const mismatchDays = calculateMismatchDuration(friend);

    return {
      trigger: TierSuggestionTrigger.UpwardMigration,
      analysis: {
        ...analysis,
        suggestedTier,
      },
      urgency: 'medium',
      direction: 'up',
      isSoftSuggestion: true,
      mismatchDurationDays: mismatchDays,
      message: `${friend.name} is connecting every ${Math.round(analysis.actualIntervalDays)} days—that's ${suggestedTier} frequency! Consider promoting this friendship.`
    };
  } catch (error) {
    console.error('[TierSuggestionEngine] Error detecting upward migration:', error);
    return null;
  }
}

/**
 * Detects prolonged tier mismatches - friends who have been in mismatch state
 * for 30+ days, warranting a soft suggestion.
 *
 * @param friendId - Friend to check for prolonged mismatch
 * @returns Tier suggestion context if prolonged mismatch detected, null otherwise
 */
export async function detectProlongedMismatch(
  friendId: string
): Promise<TierSuggestionContext | null> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);

    // Check if suggestion was recently dismissed
    if (!shouldShowTierSuggestion(friend, TierMigrationConfig.dismissalCooldownDays)) {
      return null;
    }

    // Need enough interaction history
    if ((friend.ratedWeavesCount || 0) < TierMigrationConfig.minInteractionsForSuggestion) {
      return null;
    }

    const analysis = await analyzeTierFit(friend);

    if (analysis.fitCategory !== 'mismatch') {
      return null;
    }

    const mismatchDays = calculateMismatchDuration(friend);
    const direction = determineMigrationDirection(analysis);

    // Check for dramatic mismatch (60+ days)
    if (mismatchDays >= TierMigrationConfig.daysForStrongSuggestion) {
      return {
        trigger: TierSuggestionTrigger.DramaticMismatch,
        analysis,
        urgency: 'high',
        direction: direction || undefined,
        isSoftSuggestion: false,
        mismatchDurationDays: mismatchDays,
        message: `${friend.name}'s tier hasn't matched your rhythm for ${mismatchDays} days. This friendship would thrive better in ${analysis.suggestedTier}.`
      };
    }

    // Check for prolonged mismatch (30+ days)
    if (mismatchDays >= TierMigrationConfig.daysForSoftSuggestion) {
      return {
        trigger: TierSuggestionTrigger.ProlongedMismatch,
        analysis,
        urgency: 'low',
        direction: direction || undefined,
        isSoftSuggestion: true,
        mismatchDurationDays: mismatchDays,
        message: direction === 'up'
          ? `${friend.name} has been connecting more frequently than ${friend.dunbarTier} expects for ${mismatchDays} days. Ready to level up?`
          : `${friend.name}'s tier has felt misaligned for ${mismatchDays} days. Adjusting might feel more natural.`
      };
    }

    return null;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error detecting prolonged mismatch:', error);
    return null;
  }
}

/**
 * Updates the tier fit tracking for a friend.
 * Should be called after each interaction to track mismatch duration.
 *
 * @param friendId - Friend to update
 */
export async function updateTierFitTracking(friendId: string): Promise<void> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);
    const analysis = await analyzeTierFit(friend);

    await database.write(async () => {
      await friend.update(record => {
        const previousFitScore = record.tierFitScore || 1.0;
        const currentFitScore = analysis.fitScore;

        // Update fit score
        record.tierFitScore = currentFitScore;

        // Only reset the timestamp if fit score crosses the mismatch threshold
        // This preserves duration tracking for persistent mismatches
        const wasInMismatch = previousFitScore < TierMigrationConfig.mismatchThreshold;
        const isInMismatch = currentFitScore < TierMigrationConfig.mismatchThreshold;

        if (isInMismatch && !wasInMismatch) {
          // Just entered mismatch state - start tracking
          record.tierFitLastCalculated = Date.now();
        } else if (!isInMismatch && wasInMismatch) {
          // Exited mismatch state - reset tracking
          record.tierFitLastCalculated = Date.now();
        }
        // If staying in same state, preserve the timestamp for duration tracking

        // Update suggested tier if there's a mismatch
        if (analysis.suggestedTier) {
          record.suggestedTier = analysis.suggestedTier;
        }
      });
    });
  } catch (error) {
    console.error('[TierSuggestionEngine] Error updating tier fit tracking:', error);
  }
}

/**
 * Gets comprehensive tier migration suggestions including:
 * - Prolonged mismatches (soft suggestions)
 * - Upward migration opportunities
 * - Dramatic mismatches (strong suggestions)
 *
 * @returns Array of tier suggestion contexts, sorted by urgency
 */
export async function getComprehensiveTierSuggestions(): Promise<TierSuggestionContext[]> {
  try {
    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    const suggestions: TierSuggestionContext[] = [];

    for (const friend of friends) {
      // Skip if recently dismissed
      if (!shouldShowTierSuggestion(friend, TierMigrationConfig.dismissalCooldownDays)) {
        continue;
      }

      // Check for upward migration (promotion opportunity)
      const upwardSuggestion = await detectUpwardMigration(friend.id);
      if (upwardSuggestion) {
        suggestions.push(upwardSuggestion);
        continue; // Don't double-suggest
      }

      // Check for prolonged/dramatic mismatch
      const prolongedSuggestion = await detectProlongedMismatch(friend.id);
      if (prolongedSuggestion) {
        suggestions.push(prolongedSuggestion);
        continue;
      }

      // Fall back to regular mismatch detection
      const analysis = await analyzeTierFit(friend);
      if (analysis.fitCategory === 'mismatch' && analysis.suggestedTier) {
        // Check if this is a repeated red friend (high urgency)
        const redSuggestion = await checkRepeatedRedFriend(friend.id);

        if (redSuggestion) {
          suggestions.push(redSuggestion);
        } else {
          // Regular mismatch (medium urgency)
          suggestions.push({
            trigger: TierSuggestionTrigger.PatternEstablished,
            analysis,
            urgency: 'medium',
            direction: determineMigrationDirection(analysis) || undefined,
            message: `${friend.name}'s tier doesn't match your rhythm`
          });
        }
      }
    }

    // Sort by urgency (high first), then by mismatch duration
    suggestions.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      // Secondary sort by mismatch duration
      return (b.mismatchDurationDays || 0) - (a.mismatchDurationDays || 0);
    });

    return suggestions;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error getting comprehensive suggestions:', error);
    return [];
  }
}

/**
 * Gets only soft suggestions (non-intrusive, for subtle UI hints)
 */
export async function getSoftTierSuggestions(): Promise<TierSuggestionContext[]> {
  const allSuggestions = await getComprehensiveTierSuggestions();
  return allSuggestions.filter(s => s.isSoftSuggestion);
}

/**
 * Gets only strong suggestions (for prominent UI alerts)
 */
export async function getStrongTierSuggestions(): Promise<TierSuggestionContext[]> {
  const allSuggestions = await getComprehensiveTierSuggestions();
  return allSuggestions.filter(s => !s.isSoftSuggestion && s.urgency !== 'low');
}
