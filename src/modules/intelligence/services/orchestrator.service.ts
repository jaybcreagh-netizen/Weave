import { Database, Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { type InteractionFormData } from '@/modules/interactions/types';
import { type ScoreUpdate, type QualityMetrics } from '../types';
import { calculateInteractionQuality } from './quality.service';
import { calculatePointsForWeave } from './scoring.service';
import { applyDecay } from './decay.service';
import { calculateMomentumBonus, updateMomentum } from './momentum.service';
import { updateResilience } from './resilience.service';
import { Vibe } from '@/shared/types/common';
import { InteractionType, InteractionCategory, Duration, Friend } from '@/components/types';
import Logger from '@/shared/utils/Logger';

/**
 * This is a temporary function that adapts the existing scoring service
 * to use the QualityMetrics, as intended by the architecture specification.
 * Ideally, this logic would be inside scoring.service.ts.
 */
export function calculateInteractionPoints(
  friend: FriendModel,
  interaction: InteractionFormData,
  quality: QualityMetrics,
  historyCount: number = 0
): number {
  const baseScore = calculatePointsForWeave(friend, {
    interactionType: interaction.activity as InteractionType,
    category: interaction.category as InteractionCategory,
    duration: interaction.duration as Duration | null,
    vibe: interaction.vibe as Vibe | null,
    interactionHistoryCount: historyCount,
  });

  // Example of using quality score: add a bonus based on quality.
  // A quality of 3 is neutral. Let's apply a +/- 10% modifier per point.
  const qualityModifier = 1 + (quality.overallQuality - 3) * 0.1;

  return baseScore * qualityModifier;
}

/**
 * Recalculates score when an interaction is edited.
 * Calculates the delta between old and new points and applies it to the friend.
 */
export async function recalculateScoreOnEdit(
  friendId: string,
  oldData: InteractionFormData,
  newData: InteractionFormData,
  database: Database
): Promise<void> {
  const friend = await database.get<FriendModel>('friends').find(friendId);
  if (!friend) return;

  // Calculate old points
  const oldQuality = calculateInteractionQuality({
    note: oldData.notes,
    reflectionJSON: oldData.reflection ? JSON.stringify(oldData.reflection) : undefined,
    duration: oldData.duration,
    vibe: oldData.vibe,
  });

  // For simplicity in edit, we assume history count hasn't drastically changed 
  // enough to affect the tier multiplier for this single calculation, 
  // or we accept the slight inaccuracy. Fetching exact history for both states is expensive.
  const oldPoints = calculateInteractionPoints(friend, oldData, oldQuality, 0);

  // Calculate new points
  const newQuality = calculateInteractionQuality({
    note: newData.notes,
    reflectionJSON: newData.reflection ? JSON.stringify(newData.reflection) : undefined,
    duration: newData.duration,
    vibe: newData.vibe,
  });
  const newPoints = calculateInteractionPoints(friend, newData, newQuality, 0);

  const delta = newPoints - oldPoints;

  if (delta !== 0) {
    await database.write(async () => {
      await friend.update(f => {
        f.weaveScore = Math.min(100, Math.max(0, f.weaveScore + delta));
        // We don't update lastUpdated here as the interaction date itself might not have changed,
        // or if it did, the decay service handles date-based updates. 
        // This is purely a value adjustment.
      });
    });
    Logger.info(`[Score Recalc] Friend ${friend.name}: ${oldPoints.toFixed(1)} -> ${newPoints.toFixed(1)} (Delta: ${delta.toFixed(1)})`);
  }
}

/**
 * Main entry point - coordinates all scoring services.
 * This function calculates and applies score updates to friends in a database transaction.
 * It replaces the scoring logic previously found in `lib/weave-engine.ts`.
 */
export async function processWeaveScoring(
  friends: FriendModel[],
  interactionData: InteractionFormData,
  database: Database
): Promise<ScoreUpdate[]> {
  const scoreUpdates: ScoreUpdate[] = [];

  // 1. Calculate the quality of the interaction once for all friends.
  const quality = calculateInteractionQuality({
    note: interactionData.notes,
    reflectionJSON: interactionData.reflection ? JSON.stringify(interactionData.reflection) : undefined,
    duration: interactionData.duration,
    vibe: interactionData.vibe,
  });

  // Use a single database transaction to ensure all updates are atomic.
  await database.write(async () => {
    const batchOps: any[] = [];

    for (const friend of friends) {
      const scoreBefore = calculateCurrentScore(friend);

      // NEW: Query interaction history count for affinity bonus
      // We want to know how many times we've done this specific category with this friend
      // NOTE: Q.on is failing, so we use a manual two-step query
      // We need to do this query OUTSIDE the write transaction if possible, or inside.
      // Since it's a read, it's fine inside, but we must ensure we don't start another writer.
      // database.get().query().fetch() is a reader, so it might be okay, but strictly speaking
      // mixing reads and writes in a write block is fine as long as we don't start a NEW writer.

      const interactionFriends = await database.get('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();

      const interactionIds = interactionFriends.map((r: any) => r.interactionId);

      const historyCount = await database.get('interactions')
        .query(
          Q.where('id', Q.oneOf(interactionIds)),
          Q.where('interaction_category', interactionData.category || ''),
          Q.where('status', 'completed')
        ).fetchCount();

      // 2. Calculate points earned from this specific interaction.
      let pointsEarned = calculateInteractionPoints(
        friend,
        interactionData,
        quality,
        historyCount
      );

      // 3. Apply momentum bonus for recent interactions.
      const momentumBonus = calculateMomentumBonus(friend);
      pointsEarned *= momentumBonus;

      const scoreAfter = Math.min(100, scoreBefore + pointsEarned);

      // 4. Get updates for momentum and resilience.
      const { momentumScore, momentumLastUpdated } = updateMomentum(friend);
      const newResilience = updateResilience(friend, interactionData.vibe as Vibe | null);

      // 5. Prepare update for the friend record.
      batchOps.push(friend.prepareUpdate(record => {
        record.weaveScore = scoreAfter;
        record.lastUpdated = new Date();
        record.momentumScore = momentumScore;
        record.momentumLastUpdated = momentumLastUpdated;
        if (newResilience !== null) {
          record.resilience = newResilience;
        }
        if (interactionData.vibe) {
          record.ratedWeavesCount += 1;
        }
      }));

      scoreUpdates.push({
        friendId: friend.id,
        scoreBefore,
        scoreAfter,
        pointsEarned,
      });
    }

    if (batchOps.length > 0) {
      await database.batch(batchOps);
    }
  });

  return scoreUpdates;
}

/**
 * Calculates the current score of a friend, including decay.
 * This is the public-facing function to get a score, replacing the old
 * function from weave-engine.ts.
 */
export function calculateCurrentScore(friend: FriendModel | Friend): number {
  return applyDecay(friend);
}

/**
 * Calculates weighted network health score across all tiers.
 * Uses tier-specific weights (Inner: 50%, Close: 35%, Community: 15%)
 * to prevent low-engagement community friends from dragging down overall health.
 *
 * @param {FriendModel[]} friends - Array of all friends.
 * @returns {number} Weighted network health score (0-100).
 */
export function calculateWeightedNetworkHealth(friends: FriendModel[]): number {
  if (friends.length === 0) return 0;

  // Group friends by tier
  const innerCircle = friends.filter(f => f.dunbarTier === 'InnerCircle');
  const closeFriends = friends.filter(f => f.dunbarTier === 'CloseFriends');
  const community = friends.filter(f => f.dunbarTier === 'Community');

  // Calculate average score for each tier
  const innerAvg = innerCircle.length > 0
    ? innerCircle.reduce((sum, f) => sum + calculateCurrentScore(f), 0) / innerCircle.length
    : 0;

  const closeAvg = closeFriends.length > 0
    ? closeFriends.reduce((sum, f) => sum + calculateCurrentScore(f), 0) / closeFriends.length
    : 0;

  const communityAvg = community.length > 0
    ? community.reduce((sum, f) => sum + calculateCurrentScore(f), 0) / community.length
    : 0;

  // Handle cases where some tiers are empty - redistribute weight to populated tiers
  let totalWeight = 0;
  let weightedSum = 0;

  if (innerCircle.length > 0) {
    totalWeight += 0.50;
    weightedSum += innerAvg * 0.50;
  }

  if (closeFriends.length > 0) {
    totalWeight += 0.35;
    weightedSum += closeAvg * 0.35;
  }

  if (community.length > 0) {
    totalWeight += 0.15;
    weightedSum += communityAvg * 0.15;
  }

  // Normalize by total weight (in case some tiers are empty)
  const networkHealth = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return Math.round(networkHealth);
}
