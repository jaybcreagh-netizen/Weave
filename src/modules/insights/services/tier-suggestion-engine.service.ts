// src/modules/insights/services/tier-suggestion-engine.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import { analyzeTierFit, shouldShowTierSuggestion } from './tier-fit.service';
import type { TierFitAnalysis } from '../types';

/**
 * Conditions that trigger tier suggestions
 */
export enum TierSuggestionTrigger {
  AfterInteraction = 'after_interaction',
  RepeatedRedFriend = 'repeated_red_friend',
  PatternEstablished = 'pattern_established',
  NetworkHealthLow = 'network_health_low'
}

export interface TierSuggestionContext {
  trigger: TierSuggestionTrigger;
  analysis: TierFitAnalysis;
  urgency: 'high' | 'medium' | 'low';
  message: string;
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

    // Analyze tier fit
    const analysis = analyzeTierFit(friend);

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

    // Analyze tier fit
    const analysis = analyzeTierFit(friend);

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

      const analysis = analyzeTierFit(friend);

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
