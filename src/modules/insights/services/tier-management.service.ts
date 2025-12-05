// src/modules/insights/services/tier-management.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import type { Tier } from '@/shared/types/core';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

/**
 * Change a friend's tier
 * Updates the friend's dunbarTier field in the database
 *
 * @param friendId - Friend to update
 * @param newTier - New tier to assign
 * @returns Promise that resolves when tier is changed
 */
export async function changeFriendTier(
  friendId: string,
  newTier: Tier,
  wasFromSuggestion: boolean = false
): Promise<void> {
  try {
    let oldTier: Tier | undefined;

    await database.write(async () => {
      const friend = await database.get<Friend>('friends').find(friendId);
      oldTier = friend.dunbarTier as Tier;

      await friend.update((record) => {
        record.dunbarTier = newTier;

        // Clear any tier suggestion since user took action
        record.suggestedTier = undefined;
        record.tierSuggestionDismissedAt = undefined;

        // Reset tier fit to recalculate with new tier
        record.tierFitScore = undefined;
        record.tierFitLastCalculated = undefined;
      });
    });

    // Track analytics event
    trackEvent(
      wasFromSuggestion
        ? AnalyticsEvents.TIER_SUGGESTION_ACCEPTED
        : AnalyticsEvents.TIER_CHANGED_MANUALLY,
      {
        friend_id: friendId,
        old_tier: oldTier,
        new_tier: newTier,
        tier_direction: oldTier && newTier > oldTier ? 'promotion' : 'demotion',
      }
    );


  } catch (error) {
    console.error('[TierManagement] Error changing tier:', error);
    throw error;
  }
}

/**
 * Dismiss a tier suggestion for a friend
 * Marks the suggestion as dismissed so it won't show again for 90 days
 *
 * @param friendId - Friend whose suggestion to dismiss
 * @returns Promise that resolves when suggestion is dismissed
 */
export async function dismissTierSuggestion(
  friendId: string
): Promise<void> {
  try {
    let currentTier: Tier | undefined;
    let suggestedTier: Tier | undefined;

    await database.write(async () => {
      const friend = await database.get<Friend>('friends').find(friendId);
      currentTier = friend.dunbarTier as Tier;
      suggestedTier = friend.suggestedTier as Tier | undefined;

      await friend.update((record) => {
        record.tierSuggestionDismissedAt = Date.now();
        // Keep the suggested tier for future reference, but mark as dismissed
      });
    });

    // Track analytics event
    trackEvent(AnalyticsEvents.TIER_SUGGESTION_DISMISSED, {
      friend_id: friendId,
      current_tier: currentTier,
      suggested_tier: suggestedTier,
    });


  } catch (error) {
    console.error('[TierManagement] Error dismissing suggestion:', error);
    throw error;
  }
}

/**
 * Update tier fit calculation for a friend
 * Called after interactions to keep fit analysis up-to-date
 *
 * @param friendId - Friend to update
 * @param fitScore - New fit score (0-1)
 * @param suggestedTier - Suggested tier based on analysis
 * @returns Promise that resolves when updated
 */
export async function updateTierFit(
  friendId: string,
  fitScore: number,
  suggestedTier?: Tier
): Promise<void> {
  try {
    let currentTier: Tier | undefined;

    await database.write(async () => {
      const friend = await database.get<Friend>('friends').find(friendId);
      currentTier = friend.dunbarTier as Tier;

      await friend.update((record) => {
        record.tierFitScore = fitScore;
        record.tierFitLastCalculated = Date.now();
        record.suggestedTier = suggestedTier;
      });
    });

    // Track analytics event for tier fit analysis
    trackEvent(AnalyticsEvents.TIER_FIT_ANALYZED, {
      friend_id: friendId,
      current_tier: currentTier,
      fit_score: fitScore,
      suggested_tier: suggestedTier,
      has_mismatch: suggestedTier !== undefined && suggestedTier !== currentTier,
    });


  } catch (error) {
    console.error('[TierManagement] Error updating tier fit:', error);
    throw error;
  }
}

/**
 * Batch update suggested tiers for multiple friends
 * Useful for network-wide rebalancing
 *
 * @param updates - Array of { friendId, newTier } objects
 * @returns Promise that resolves when all updates complete
 */
export async function batchChangeTiers(
  updates: Array<{ friendId: string; newTier: Tier }>
): Promise<void> {
  try {
    const tierChanges: Array<{ friendId: string; oldTier: Tier; newTier: Tier }> = [];

    await database.write(async () => {
      for (const { friendId, newTier } of updates) {
        const friend = await database.get<Friend>('friends').find(friendId);
        const oldTier = friend.dunbarTier as Tier;

        await friend.update((record) => {
          record.dunbarTier = newTier;
          record.suggestedTier = undefined;
          record.tierSuggestionDismissedAt = undefined;
          record.tierFitScore = undefined;
          record.tierFitLastCalculated = undefined;
        });

        tierChanges.push({ friendId, oldTier, newTier });
      }
    });

    // Track analytics event for batch changes
    trackEvent(AnalyticsEvents.TIER_BATCH_CHANGED, {
      friend_count: updates.length,
      tier_changes: tierChanges.map((change) => ({
        old_tier: change.oldTier,
        new_tier: change.newTier,
      })),
    });


  } catch (error) {
    console.error('[TierManagement] Error batch changing tiers:', error);
    throw error;
  }
}
