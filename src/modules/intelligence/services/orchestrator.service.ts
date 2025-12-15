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
import { recalculateScoreOnDelete as orchestratorRecalculateScoreOnDelete } from '@/modules/intelligence/services/orchestrator.service';
import Interaction from '@/db/models/Interaction';

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
  // Quality is calculated internally by calculatePointsForWeave.
  // enough to affect the tier multiplier for this single calculation.
  const oldPoints = calculatePointsForWeave(friend, { ...toWeaveData(oldData, 0), ignoreMomentum: true }); // Ignore momentum on OLD data too to be safe? Or should match logic.
  // Actually, for EDIT, we want delta. If we ignore momentum on OLD, we should ignore on NEW?
  // If we don't, we are changing the basis.
  // Best to ignore momentum on BOTH for edits to isolate value change.
  const newPoints = calculatePointsForWeave(friend, { ...toWeaveData(newData, 0), ignoreMomentum: true });

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

  for (const friend of friends) {
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
      // We query interactions directly, joining on interaction_friends
      const latestInteractions = await database.get<Interaction>('interactions').query(
        Q.experimentalJoinTables(['interaction_friends']),
        Q.on('interaction_friends', Q.where('friend_id', friend.id)),
        Q.where('status', 'completed'),
        Q.where('id', Q.notEq(interaction.id)),
        Q.sortBy('interaction_date', Q.desc),
        Q.take(1)
      ).fetch();

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

    batchOps.push(friend.prepareUpdate(f => {
      f.weaveScore = Math.min(100, Math.max(0, f.weaveScore - pointsToRemove));
      if (isLatest && newLastUpdated) {
        f.lastUpdated = newLastUpdated;
      }
    }));

    Logger.info(`[Score Revert] Friend ${friend.name}: Removed ${pointsToRemove.toFixed(1)} pts`);
  }

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
export async function processWeaveScoring(
  friends: FriendModel[],
  interactionData: InteractionFormData,
  database: Database,
  season?: SocialSeason | null
): Promise<ScoreUpdate[]> {
  const scoreUpdates: ScoreUpdate[] = [];

  // 1. Pre-fetch interaction history counts for all friends
  // We do this OUTSIDE the write transaction to avoid holding the lock during reads
  const historyCounts = new Map<string, number>();

  // Extract all friend IDs
  const friendIds = friends.map(f => f.id);

  if (friendIds.length > 0) {
    // Step A: Fetch all link records for these friends
    // Batching friend IDs in chunks of 900 to be safe (SQLite limit is usually 999 variables)
    const FRIEND_BATCH_SIZE = 900;
    let allLinks: any[] = [];

    for (let i = 0; i < friendIds.length; i += FRIEND_BATCH_SIZE) {
      const batch = friendIds.slice(i, i + FRIEND_BATCH_SIZE);
      const links = await database.get('interaction_friends')
        .query(Q.where('friend_id', Q.oneOf(batch)))
        .fetch();
      allLinks = allLinks.concat(links);
    }

    // Step B: Extract all unique interaction IDs linked to these friends
    const allInteractionIds = Array.from(new Set(allLinks.map((r: any) => r.interactionId)));

    // Step C: Fetch valid interactions (matching category & status)
    // We also valid interaction IDs to ensure we only count completed ones of the right category
    const validInteractionIds = new Set<string>();

    if (allInteractionIds.length > 0) {
      const ID_BATCH_SIZE = 900;
      for (let i = 0; i < allInteractionIds.length; i += ID_BATCH_SIZE) {
        const batch = allInteractionIds.slice(i, i + ID_BATCH_SIZE);
        const validInteractions = await database.get('interactions')
          .query(
            Q.where('id', Q.oneOf(batch)),
            Q.where('interaction_category', interactionData.category || ''),
            Q.where('status', 'completed')
          ).fetch();

        validInteractions.forEach((interaction: any) => validInteractionIds.add(interaction.id));
      }
    }

    // Step D: Aggregate counts
    // validInteractionIds now contains only IDs of interactions that match our criteria
    // We iterate through the links again to count valid interactions per friend
    allLinks.forEach((link: any) => {
      if (validInteractionIds.has(link.interactionId)) {
        const currentCount = historyCounts.get(link.friendId) || 0;
        historyCounts.set(link.friendId, currentCount + 1);
      }
    });
  }

  // Use a single database transaction to ensure all updates are atomic.
  await database.write(async () => {
    const batchOps: any[] = [];

    for (const friend of friends) {
      const scoreBefore = calculateCurrentScore(friend);

      // Get pre-fetched history count
      const historyCount = historyCounts.get(friend.id) || 0;

      // 2. Calculate points earned from this specific interaction.
      // Quality is calculated internally by calculatePointsForWeave.
      let pointsEarned = calculatePointsForWeave(
        friend,
        toWeaveData(interactionData, historyCount)
      );

      // 3. Apply momentum bonus for recent interactions.
      const momentumBonus = calculateMomentumBonus(friend);
      pointsEarned *= momentumBonus;

      // 4. Apply season scoring bonus
      // Resting: +20% for any interaction, Blooming: +10% for high-quality
      if (season) {
        pointsEarned = applySeasonScoringBonus(pointsEarned, season, interactionData.vibe as Vibe | null);
      }

      // Backdating Logic: calculate score based on interaction date relative to last update
      const rawScore = friend.weaveScore;
      const lastUpdated = friend.lastUpdated || new Date(0);
      const rawInteractionDate = interactionData.date ? new Date(interactionData.date) : new Date();
      // Clamp date to now to prevent future dates from locking the timeline
      const now = new Date();
      const interactionDate = isAfter(rawInteractionDate, now) ? now : rawInteractionDate;

      let newScore = rawScore;
      let newLastUpdated = lastUpdated;
      let effectivePoints = pointsEarned;
      let isNewerInteraction = false;

      if (isAfter(interactionDate, lastUpdated)) {
        // Case 1: Newer Interaction (Standard flow or "Fast-forward")
        // We move the state forward to this new date.
        // First, apply decay that occurred between lastUpdated and this new interaction.
        const gap = differenceInDays(interactionDate, lastUpdated);
        const decay = calculateDecayAmount(friend, gap);

        // Then add the fresh points
        newScore = Math.max(0, rawScore - decay) + pointsEarned;
        newLastUpdated = interactionDate;
        isNewerInteraction = true;
      } else {
        // Case 2: Older interaction (Back-filling)
        // The state (lastUpdated) is anchored in the future relative to this event.
        // We do NOT move lastUpdated back.
        // Instead, we discount the points based on how much they WOULD have decayed 
        // from the interaction date to the current lastUpdated date.
        const gap = differenceInDays(lastUpdated, interactionDate);
        const penalty = calculateDecayAmount(friend, gap);
        effectivePoints = Math.max(0, pointsEarned - penalty);
        newScore = rawScore + effectivePoints;
      }

      const scoreAfterRaw = Math.min(100, newScore);

      // 4. Get updates for momentum and resilience (only if moving timeline forward)
      let momentumScore: number | undefined;
      let momentumLastUpdated: Date | undefined;
      let newResilience: number | null | undefined;

      if (isNewerInteraction) {
        const momentumResult = updateMomentum(friend);
        momentumScore = momentumResult.momentumScore;
        momentumLastUpdated = momentumResult.momentumLastUpdated;
        newResilience = updateResilience(friend, interactionData.vibe as Vibe | null);
      }

      // 5. Prepare update for the friend record.
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

      // For the UI return value, we estimate the impact on the current viewed score
      const scoreAfter = Math.min(100, scoreBefore + effectivePoints);

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
  // Ensure we never return NaN
  return isNaN(score) ? 0 : score;
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

    await database.write(async () => {
      await database.get('network_health_logs').create((log: any) => {
        log.score = score;
        log.timestamp = new Date(now);
      });
    });
  } catch (error) {
    Logger.error('Error logging network health:', error);
  }
}
