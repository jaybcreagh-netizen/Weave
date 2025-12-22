// src/modules/insights/services/tier-suggestion-engine.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { analyzeTierFit, shouldShowTierSuggestion } from './tier-fit.service';
import type { TierFitAnalysis } from '../types';

/**
 * Simplified tier suggestion context.
 * Focuses on the core signal: does this friend's tier match their rhythm?
 */
export interface TierSuggestionContext {
  analysis: TierFitAnalysis;
  urgency: 'high' | 'medium' | 'low';
  message: string;
  /** Direction of suggested migration */
  direction: 'up' | 'down';
}

/**
 * Helper to determine if an analysis warrants a tier suggestion.
 */
function hasTierSuggestion(analysis: TierFitAnalysis): boolean {
  return (
    (analysis.fitCategory === 'over_investing' || analysis.fitCategory === 'under_investing') &&
    analysis.suggestedTier !== undefined
  );
}

/**
 * Get urgency level based on confidence and sample size.
 * More confident = higher urgency.
 */
function getUrgency(analysis: TierFitAnalysis): 'high' | 'medium' | 'low' {
  if (analysis.confidence >= 0.8 && analysis.interactionCount >= 10) {
    return 'high';
  }
  if (analysis.confidence >= 0.6 && analysis.interactionCount >= 5) {
    return 'medium';
  }
  return 'low';
}

/**
 * Get all tier suggestions for the user's network.
 * This is the main entry point for tier suggestion UI.
 *
 * @returns Array of tier suggestion contexts, sorted by urgency
 */
export async function getTierSuggestions(): Promise<TierSuggestionContext[]> {
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

      const analysis = await analyzeTierFit(friend);

      // Only include if there's a clear tier suggestion
      if (!hasTierSuggestion(analysis)) {
        continue;
      }

      const direction = analysis.fitCategory === 'over_investing' ? 'up' : 'down';

      suggestions.push({
        analysis,
        urgency: getUrgency(analysis),
        direction,
        message: analysis.reason
      });
    }

    // Sort by urgency (high first), then by confidence
    suggestions.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      return b.analysis.confidence - a.analysis.confidence;
    });

    return suggestions;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error getting tier suggestions:', error);
    return [];
  }
}

/**
 * Check if tier suggestion should be shown after logging an interaction.
 * Only triggers at interaction milestones (5th, 10th, 15th).
 *
 * @param friendId - Friend who was just interacted with
 * @returns Tier suggestion context if should show, null otherwise
 */
export async function checkTierSuggestionAfterInteraction(
  friendId: string
): Promise<TierSuggestionContext | null> {
  try {
    const friend = await database.get<Friend>('friends').find(friendId);

    // Need at least 5 interactions for a meaningful pattern
    if (friend.ratedWeavesCount < 5) {
      return null;
    }

    // Only trigger at milestones to avoid being noisy
    const milestones = [5, 10, 15, 20];
    if (!milestones.includes(friend.ratedWeavesCount)) {
      return null;
    }

    // Check if suggestion was recently dismissed
    if (!shouldShowTierSuggestion(friend, 90)) {
      return null;
    }

    const analysis = await analyzeTierFit(friend);

    if (!hasTierSuggestion(analysis)) {
      return null;
    }

    const direction = analysis.fitCategory === 'over_investing' ? 'up' : 'down';

    return {
      analysis,
      urgency: 'medium',
      direction,
      message: `After ${friend.ratedWeavesCount} interactions, we've learned your rhythm with ${friend.name}!`
    };
  } catch (error) {
    console.error('[TierSuggestionEngine] Error checking after interaction:', error);
    return null;
  }
}

/**
 * Check if network health is low and needs rebalancing.
 * Returns true if multiple friends have tier misalignments.
 *
 * @returns Whether to prompt for network rebalancing
 */
export async function shouldPromptNetworkRebalancing(): Promise<boolean> {
  try {
    const suggestions = await getTierSuggestions();
    // Prompt if 3+ friends have tier suggestions
    return suggestions.length >= 3;
  } catch (error) {
    console.error('[TierSuggestionEngine] Error checking network health:', error);
    return false;
  }
}

// ============================================
// DEPRECATED EXPORTS (for backwards compatibility)
// These will be removed in a future version.
// ============================================

/** @deprecated Use getTierSuggestions() instead */
export const getComprehensiveTierSuggestions = getTierSuggestions;

/** @deprecated Use getTierSuggestions() instead */
export const getActiveTierSuggestions = getTierSuggestions;

/** @deprecated Use getTierSuggestions() with filter instead */
export async function getSoftTierSuggestions(): Promise<TierSuggestionContext[]> {
  const all = await getTierSuggestions();
  return all.filter(s => s.urgency === 'low');
}

/** @deprecated Use getTierSuggestions() with filter instead */
export async function getStrongTierSuggestions(): Promise<TierSuggestionContext[]> {
  const all = await getTierSuggestions();
  return all.filter(s => s.urgency === 'high' || s.urgency === 'medium');
}

/** @deprecated No longer needed - tier fit is calculated on-the-fly */
export async function updateTierFitTracking(_friendId: string): Promise<void> {
  // No-op: tier fit is now calculated on-the-fly in analyzeTierFit()
}

// Legacy enum kept for backwards compatibility
export enum TierSuggestionTrigger {
  AfterInteraction = 'after_interaction',
  RepeatedRedFriend = 'repeated_red_friend',
  PatternEstablished = 'pattern_established',
  NetworkHealthLow = 'network_health_low',
  ProlongedMismatch = 'prolonged_mismatch',
  UpwardMigration = 'upward_migration',
  DramaticMismatch = 'dramatic_mismatch'
}
