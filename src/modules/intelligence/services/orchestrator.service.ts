import { MAX_INTERACTION_SCORE, SCORE_BUFFER_CAP } from '../constants';
import { Database, Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { type InteractionFormData } from '@/shared/types/scoring.types';
import { type ScoreUpdate } from '../types';
import { calculatePointsForWeave } from './scoring.service';
import { applyDecay, calculateDecayAmount } from './decay.service';
import { differenceInDays, isAfter } from 'date-fns';
import { calculateMomentumBonus, updateMomentum } from './momentum.service';
import { updateResilience } from './resilience.service';
import { applySeasonScoringBonus } from './social-season/season-scoring.service';
import { Vibe } from '@/shared/types/common';
import { InteractionCategory, Duration, Friend } from '@/shared/types/legacy-types';
import type { InteractionType } from '@/shared/types/legacy-types';
import type { SocialSeason } from '@/db/models/UserProfile';
import Logger from '@/shared/utils/Logger';
import { eventBus } from '@/shared/events/event-bus';
import { writeScheduler } from '@/shared/services/write-scheduler';

import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

/**
 * Helper to convert InteractionFormData to the weaveData format expected by calculatePointsForWeave.
 */
function toWeaveData(
  interaction: InteractionFormData,
  historyCount: number = 0
): Parameters<typeof calculatePointsForWeave>[1] {
  return {
    interactionType: interaction.activity as InteractionType,
    category: interaction.category as InteractionCategory,
    duration: interaction.duration as Duration | null,
    vibe: interaction.vibe as Vibe | null,
    note: interaction.notes,
    reflectionJSON: interaction.reflection ? JSON.stringify(interaction.reflection) : undefined,
    interactionHistoryCount: historyCount,
  };
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

  // Calculate old and new points using the scoring service directly.
  // We ignore momentum on BOTH to isolate the pure value-delta of the edit.
  // Edits change content, not timing—momentum reflects when interactions happened,
  // so including it would create an inconsistent basis for comparison.
  const oldPoints = calculatePointsForWeave(friend, { ...toWeaveData(oldData, 0), ignoreMomentum: true });
  const newPoints = calculatePointsForWeave(friend, { ...toWeaveData(newData, 0), ignoreMomentum: true });

  const delta = newPoints - oldPoints;

  if (delta !== 0) {
    await writeScheduler.background('Intelligence:recalcScore', async () => {
      await friend.update(f => {
        // Use SCORE_BUFFER_CAP for storage to allow deletion headroom,
        // but still prevent infinite accumulation.
        f.weaveScore = Math.min(SCORE_BUFFER_CAP, Math.max(0, f.weaveScore + delta));
        // We don't update lastUpdated here as the interaction date itself might not have changed,
        // or if it did, the decay service handles date-based updates. 
        // This is purely a value adjustment.
      });
    });
    Logger.info(`[Score Recalc] Friend ${friend.name}: ${oldPoints.toFixed(1)} -> ${newPoints.toFixed(1)} (Delta: ${delta.toFixed(1)})`);
  }
}

/**
 * Recalculates score when an interaction is deleted.
 * Reverts the points earned and potentially rolls back lastUpdated.
 */
export async function recalculateScoreOnDelete(
  interaction: Interaction,
  friends: FriendModel[],
  database: Database
): Promise<void> {
  // Helper to convert model to weave data
  const interactionData = {
    interactionType: interaction.activity as InteractionType,
    category: interaction.interactionCategory as InteractionCategory,
    duration: interaction.duration as Duration | null,
    vibe: interaction.vibe as Vibe | null,
    note: interaction.note,
    reflectionJSON: interaction.reflectionJSON,
    interactionHistoryCount: 0, // Fallback, won't drastically change removal logic
    ignoreMomentum: true, // Use base points only to avoid excessive deduction
  };

  const batchOps: any[] = [];

  // Parallelize the calculation and data fetching for each friend to avoid N+1 queries
  const opsPromises = friends.map(async (friend) => {
    // 1. Calculate points that were added
    const pointsToRemove = calculatePointsForWeave(friend, interactionData);

    // 2. Determine if we need to rollback lastUpdated
    // If the deleted interaction has the same date as lastUpdated, we might need to find the previous one
    let newLastUpdated = friend.lastUpdated;
    const interactionDate = new Date(interaction.interactionDate);

    // Check if dates are close enough (ignoring milliseconds diffs that might happen)
    const isLatest = friend.lastUpdated &&
      Math.abs(friend.lastUpdated.getTime() - interactionDate.getTime()) < 1000;

    if (isLatest) {
      // Find the most recent completed interaction that ISN'T this one
      // NOTE: Using manual two-step query to avoid Q.on issues on physical devices (per project memory)

      // Step A: Get interaction IDs for this friend
      const friendLinks = await database.get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();
      const friendInteractionIds = friendLinks
        .map(l => l.interactionId)
        .filter(id => id !== interaction.id); // Exclude the one being deleted

      // Step B: Find the most recent completed interaction
      let latestInteractions: Interaction[] = [];
      if (friendInteractionIds.length > 0) {
        latestInteractions = await database.get<Interaction>('interactions')
          .query(
            Q.where('id', Q.oneOf(friendInteractionIds)),
            Q.where('status', 'completed'),
            Q.sortBy('interaction_date', Q.desc),
            Q.take(1)
          ).fetch();
      }

      if (latestInteractions.length > 0) {
        const latest = latestInteractions[0];
        if (latest.interactionDate) {
          newLastUpdated = latest.interactionDate;
        }
      } else {
        // No other interactions?
        if (friend.weaveScore - pointsToRemove <= 0) {
          newLastUpdated = new Date(0);
        }
      }
    }

    Logger.info(`[Score Revert] Friend ${friend.name}: Removed ${pointsToRemove.toFixed(1)} pts`);

    return friend.prepareUpdate(f => {
      // Allow score to drop, capped by buffer (though usually we just care about min 0)
      f.weaveScore = Math.min(SCORE_BUFFER_CAP, Math.max(0, f.weaveScore - pointsToRemove));
      if (isLatest && newLastUpdated) {
        f.lastUpdated = newLastUpdated;
      }
    });
  });

  const ops = await Promise.all(opsPromises);
  batchOps.push(...ops);

  if (batchOps.length > 0) {
    await database.batch(batchOps);
  }
}


/**
 * Main entry point - coordinates all scoring services.
 * This function calculates and applies score updates to friends in a database transaction.
 * It replaces the scoring logic previously found in `lib/weave-engine.ts`.
 *
 * @param friends - Friends to update scores for
 * @param interactionData - The interaction being logged
 * @param database - Database instance for the transaction
 * @param season - Optional social season for season-aware scoring bonuses
 */
/**
 * Prepares scoring operations without executing them.
 * Useful for batching multiple scoring updates (e.g., at app startup).
 */
export async function prepareWeaveScoringOps(
  friends: FriendModel[],
  interactionData: InteractionFormData,
  database: Database,
  season?: SocialSeason | null
): Promise<{ scoreUpdates: ScoreUpdate[], ops: any[] }> {
  const scoreUpdates: ScoreUpdate[] = [];

  // 1. Pre-fetch interaction history counts for all friends
  const historyCounts = new Map<string, number>();
  const historyStart = Date.now();

  // Optimization: Parallelize checks per friend.
  // We only need to know if the count is >= 5 for the affinity bonus.
  await Promise.all(friends.map(async (friend) => {
    try {
      const linkStart = Date.now();
      // Step A: Get interaction IDs for this friend
      const links = await database.get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();
      Logger.info(`[Perf] Friend ${friend.name}: links fetch ${Date.now() - linkStart}ms (${links.length} links)`);

      const interactionIds = links.map(l => l.interactionId);

      if (interactionIds.length === 0) {
        historyCounts.set(friend.id, 0);
        return;
      }

      // Step B: Check if we have at least 5 qualifying interactions
      // Note: Q.take() is not supported with fetchCount, so we fetch() and count
      const countStart = Date.now();
      let totalFound = 0;

      // Optimization: Only check first batch since we just need >= 5
      const ID_BATCH_SIZE = 100; // Smaller batch for faster initial check
      const batch = interactionIds.slice(0, ID_BATCH_SIZE);

      const matchingInteractions = await database.get('interactions')
        .query(
          Q.where('id', Q.oneOf(batch)),
          Q.where('interaction_category', interactionData.category || ''),
          Q.where('status', 'completed')
        ).fetch();

      totalFound = matchingInteractions.length;
      Logger.info(`[Perf] Friend ${friend.name}: count query ${Date.now() - countStart}ms (found: ${totalFound})`);

      historyCounts.set(friend.id, totalFound);

    } catch (error) {
      Logger.error(`Error fetching history count for friend ${friend.id}`, error);
      historyCounts.set(friend.id, 0);
    }
  }));
  Logger.info(`[Perf] History counts total: ${Date.now() - historyStart}ms`);

  const batchOps: any[] = [];

  for (const friend of friends) {
    const scoreBefore = calculateCurrentScore(friend);
    const historyCount = historyCounts.get(friend.id) || 0;

    let pointsEarned = calculatePointsForWeave(
      friend,
      toWeaveData(interactionData, historyCount)
    );

    const momentumBonus = calculateMomentumBonus(friend);
    pointsEarned *= momentumBonus;

    if (season) {
      pointsEarned = applySeasonScoringBonus(pointsEarned, season, interactionData.vibe as Vibe | null);
    }

    const rawScore = friend.weaveScore;
    const lastUpdated = friend.lastUpdated || new Date(0);
    const rawInteractionDate = interactionData.date ? new Date(interactionData.date) : new Date();
    const now = new Date();
    const interactionDate = isAfter(rawInteractionDate, now) ? now : rawInteractionDate;

    let newScore = rawScore;
    let newLastUpdated = lastUpdated;
    let effectivePoints = pointsEarned;
    let isNewerInteraction = false;

    if (isAfter(interactionDate, lastUpdated)) {
      const gap = differenceInDays(interactionDate, lastUpdated);
      const decay = calculateDecayAmount(friend, gap);
      newScore = Math.max(0, rawScore - decay) + pointsEarned;
      newLastUpdated = interactionDate;
      isNewerInteraction = true;
    } else {
      const gap = differenceInDays(lastUpdated, interactionDate);
      const penalty = calculateDecayAmount(friend, gap);
      effectivePoints = Math.max(0, pointsEarned - penalty);
      newScore = rawScore + effectivePoints;
    }

    const scoreAfterRaw = Math.min(SCORE_BUFFER_CAP, newScore);

    let momentumScore: number | undefined;
    let momentumLastUpdated: Date | undefined;
    let newResilience: number | null | undefined;

    if (isNewerInteraction) {
      const momentumResult = updateMomentum(friend);
      momentumScore = momentumResult.momentumScore;
      momentumLastUpdated = momentumResult.momentumLastUpdated;
      newResilience = updateResilience(friend, interactionData.vibe as Vibe | null);
    }

    batchOps.push(friend.prepareUpdate(record => {
      record.weaveScore = scoreAfterRaw;
      record.lastUpdated = newLastUpdated;

      if (isNewerInteraction) {
        if (momentumScore !== undefined) record.momentumScore = momentumScore;
        if (momentumLastUpdated !== undefined) record.momentumLastUpdated = momentumLastUpdated;
        if (newResilience !== undefined && newResilience !== null) {
          record.resilience = newResilience;
        }
      }

      if (interactionData.vibe) {
        record.ratedWeavesCount += 1;
      }
    }));

    const scoreAfter = Math.min(100, Math.max(0, scoreBefore + effectivePoints));

    scoreUpdates.push({
      friendId: friend.id,
      scoreBefore,
      scoreAfter,
      pointsEarned,
    });
  }

  return { scoreUpdates, ops: batchOps };
}

/**
 * Main entry point - coordinates all scoring services.
 * Executed in a single write transaction.
 */
export async function processWeaveScoring(
  friends: FriendModel[],
  interactionData: InteractionFormData,
  database: Database,
  season?: SocialSeason | null
): Promise<ScoreUpdate[]> {
  const { scoreUpdates, ops } = await prepareWeaveScoringOps(friends, interactionData, database, season);

  if (ops.length > 0) {
    // BACKGROUND PRIORITY: Scoring can wait, user actions take priority
    await writeScheduler.background('Intelligence:scoring', async () => {
      await database.batch(ops);
    });
  }

  return scoreUpdates;
}

/**
 * Calculates the current score of a friend, including decay.
 * This is the public-facing function to get a score, replacing the old
 * function from weave-engine.ts.
 *
 * @param friend - The friend to calculate score for
 * @param season - Optional social season for season-aware decay multipliers
 * @returns Current score after decay (0-100)
 */
export function calculateCurrentScore(
  friend: FriendModel | Friend,
  season?: SocialSeason | null
): number {
  const score = applyDecay(friend, 'balanced', true, season);
  // Ensure we never return NaN, and CAP at 100 for display/logic consumption
  return Math.min(100, isNaN(score) ? 0 : score);
}

/**
 * Calculates weighted network health score across all tiers.
 * Uses tier-specific weights (Inner: 50%, Close: 35%, Community: 15%)
 * to prevent low-engagement community friends from dragging down overall health.
 *
 * @param friends - Array of all friends.
 * @param season - Optional social season for season-aware decay multipliers
 * @returns Weighted network health score (0-100).
 */
export function calculateWeightedNetworkHealth(
  friends: FriendModel[],
  season?: SocialSeason | null
): number {
  if (friends.length === 0) return 0;

  // Group friends by tier
  const innerCircle = friends.filter(f => f.dunbarTier === 'InnerCircle');
  const closeFriends = friends.filter(f => f.dunbarTier === 'CloseFriends');
  const community = friends.filter(f => f.dunbarTier === 'Community');

  // Calculate average score for each tier
  const innerAvg = innerCircle.length > 0
    ? innerCircle.reduce((sum, f) => sum + calculateCurrentScore(f, season), 0) / innerCircle.length
    : 0;

  const closeAvg = closeFriends.length > 0
    ? closeFriends.reduce((sum, f) => sum + calculateCurrentScore(f, season), 0) / closeFriends.length
    : 0;

  const communityAvg = community.length > 0
    ? community.reduce((sum, f) => sum + calculateCurrentScore(f, season), 0) / community.length
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

/**
 * Logs the current network health score to the database.
 * To prevent spam, it only logs if the last log was more than 24 hours ago,
 * or if force is true.
 */
export async function logNetworkHealth(score: number, database: Database, force: boolean = false): Promise<void> {
  try {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    if (!force) {
      // Check for recent logs
      const recentLogs = await database.get('network_health_logs')
        .query(
          Q.where('timestamp', Q.gte(twentyFourHoursAgo)),
          Q.sortBy('timestamp', Q.desc),
          Q.take(1)
        )
        .fetch();

      if (recentLogs.length > 0) {
        // Already logged recently
        return;
      }
    }

    writeScheduler.background('Intelligence:networkHealthLog', async () => {
      await database.get('network_health_logs').create((log: any) => {
        log.score = score;
        log.timestamp = new Date(now);
      });
    });
  } catch (error) {
    Logger.error('Error logging network health:', error);
  }
}
