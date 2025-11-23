import { Database } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { type InteractionFormData } from '@/modules/interactions/types';
import { type ScoreUpdate, type QualityMetrics } from '../types';
import { calculateInteractionQuality } from './quality.service';
import { calculatePointsForWeave } from './scoring.service';
import { applyDecay } from './decay.service';
import { calculateMomentumBonus, updateMomentum } from './momentum.service';
import { updateResilience } from './resilience.service';
import { Vibe } from '@/shared/types/common';
import { InteractionType, Category, Duration } from '@/components/types';

/**
 * This is a temporary function that adapts the existing scoring service
 * to use the QualityMetrics, as intended by the architecture specification.
 * Ideally, this logic would be inside scoring.service.ts.
 */
function calculateInteractionPoints(
  friend: FriendModel,
  interaction: InteractionFormData,
  quality: QualityMetrics
): number {
  const baseScore = calculatePointsForWeave(friend, {
    interactionType: interaction.activity as InteractionType,
    category: interaction.category as Category,
    duration: interaction.duration as Duration | null,
    vibe: interaction.vibe as Vibe | null,
  });

  // Example of using quality score: add a bonus based on quality.
  // A quality of 3 is neutral. Let's apply a +/- 10% modifier per point.
  const qualityModifier = 1 + (quality.overallQuality - 3) * 0.1;

  return baseScore * qualityModifier;
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
    for (const friend of friends) {
      const scoreBefore = calculateCurrentScore(friend);

      // 2. Calculate points earned from this specific interaction.
      let pointsEarned = calculateInteractionPoints(
        friend,
        interactionData,
        quality
      );

      // 3. Apply momentum bonus for recent interactions.
      const momentumBonus = calculateMomentumBonus(friend);
      pointsEarned *= momentumBonus;

      const scoreAfter = Math.min(100, scoreBefore + pointsEarned);

      // 4. Get updates for momentum and resilience.
      const { momentumScore, momentumLastUpdated } = updateMomentum(friend);
      const newResilience = updateResilience(friend, interactionData.vibe as Vibe | null);

      // 5. Apply all calculated updates to the friend record.
      await friend.update(record => {
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
      });

      scoreUpdates.push({
        friendId: friend.id,
        scoreBefore,
        scoreAfter,
        pointsEarned,
      });
    }
  });

  return scoreUpdates;
}

/**
 * Calculates the current score of a friend, including decay.
 * This is the public-facing function to get a score, replacing the old
 * function from weave-engine.ts.
 */
export function calculateCurrentScore(friend: FriendModel): number {
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
