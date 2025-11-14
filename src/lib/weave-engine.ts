import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { Friend, Interaction, Tier, Archetype, InteractionType, InteractionCategory, Duration, Vibe } from '../components/types';
import { TierDecayRates, InteractionBaseScores, CategoryBaseScores, DurationModifiers, VibeMultipliers, RecencyFactors, ArchetypeMatrixV2, CategoryArchetypeMatrix, TierWeights, TierHealthThresholds } from './constants';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import IntentionFriend from '../db/models/IntentionFriend';
import UserProgress from '../db/models/UserProgress';
import Intention from '../db/models/Intention';
import { type InteractionFormData } from '../stores/interactionStore';
import { checkAndAwardFriendBadges, checkSpecialBadges, BadgeUnlock } from './badge-tracker';
import { checkAndAwardGlobalAchievements, checkHiddenAchievements, AchievementUnlockData } from './achievement-tracker';
import { analyzeInteractionPattern, calculateToleranceWindow, isPatternReliable } from './pattern-analyzer';
import { captureInteractionOutcome, measurePendingOutcomes, getLearnedEffectiveness } from './feedback-analyzer';
import { updateInitiationStats, type Initiator } from './reciprocity-analyzer';
import { trackEvent, AnalyticsEvents, updateLastInteractionTimestamp } from './analytics';

/**
 * Quality metrics for an interaction based on depth and energy
 */
export interface InteractionQualityMetrics {
  depthScore: number; // 1-5 based on reflection + notes
  energyScore: number; // 1-5 based on vibe + duration
  overallQuality: number; // 1-5 composite
}

/**
 * Calculates quality metrics for an interaction to weight scoring
 */
export function calculateInteractionQuality(
  interaction: {
    vibe?: Vibe | null;
    duration?: Duration | null;
    note?: string | null;
    reflectionJSON?: string | null;
  }
): InteractionQualityMetrics {
  // Depth: Did they reflect meaningfully?
  let depthScore = 1; // Base score for just logging
  if (interaction.note && interaction.note.length > 50) depthScore += 1;
  if (interaction.note && interaction.note.length > 150) depthScore += 1;
  if (interaction.reflectionJSON) depthScore += 2; // Structured reflection is valuable

  depthScore = Math.min(5, depthScore); // Cap at 5

  // Energy: How was the vibe + duration?
  let energyScore = 3; // Default neutral
  if (interaction.vibe === 'FullMoon') energyScore = 5;
  else if (interaction.vibe === 'WaxingGibbous') energyScore = 4;
  else if (interaction.vibe === 'FirstQuarter') energyScore = 3;
  else if (interaction.vibe === 'WaxingCrescent') energyScore = 3;
  else if (interaction.vibe === 'NewMoon') energyScore = 2;

  // Duration modifier
  if (interaction.duration === 'Extended') energyScore = Math.min(5, energyScore + 1);
  else if (interaction.duration === 'Quick') energyScore = Math.max(1, energyScore - 1);

  const overallQuality = Math.round((depthScore + energyScore) / 2);

  return { depthScore, energyScore, overallQuality };
}

/**
 * Calculates the decayed score of a friend based on the time since the last update.
 * Uses adaptive decay that respects each friendship's natural rhythm.
 */
export function calculateCurrentScore(friend: FriendModel): number {
  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];

  // Use learned tolerance window if available, otherwise fall back to tier defaults
  const toleranceWindow = friend.toleranceWindowDays || {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier as Tier];

  let decayAmount: number;

  if (daysSinceLastUpdate <= toleranceWindow) {
    // Within normal pattern - minimal decay (50% of base rate)
    decayAmount = (daysSinceLastUpdate * tierDecayRate * 0.5) / friend.resilience;
  } else {
    // Outside tolerance - accelerating decay
    const excessDays = daysSinceLastUpdate - toleranceWindow;
    const baseDecay = (toleranceWindow * tierDecayRate * 0.5) / friend.resilience;
    const acceleratedDecay = (excessDays * tierDecayRate * 1.5) / friend.resilience;
    decayAmount = baseDecay + acceleratedDecay;
  }

  return Math.max(0, friend.weaveScore - decayAmount);
}

/**
 * Calculates weighted network health score across all tiers.
 * Uses tier-specific weights (Inner: 50%, Close: 35%, Community: 15%)
 * to prevent low-engagement community friends from dragging down overall health.
 *
 * @param friends - Array of all friends
 * @returns Weighted network health score (0-100)
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
    totalWeight += TierWeights.InnerCircle;
    weightedSum += innerAvg * TierWeights.InnerCircle;
  }

  if (closeFriends.length > 0) {
    totalWeight += TierWeights.CloseFriends;
    weightedSum += closeAvg * TierWeights.CloseFriends;
  }

  if (community.length > 0) {
    totalWeight += TierWeights.Community;
    weightedSum += communityAvg * TierWeights.Community;
  }

  // Normalize by total weight (in case some tiers are empty)
  const networkHealth = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return Math.round(networkHealth);
}

/**
 * Calculates group dilution factor based on the number of people in the interaction.
 * Larger groups mean less individual attention and depth per person.
 */
export function calculateGroupDilution(groupSize: number): number {
  if (groupSize === 1) return 1.0;      // Full points for 1-on-1
  if (groupSize === 2) return 0.9;      // 10% dilution for trio
  if (groupSize <= 4) return 0.7;       // 30% dilution for small group
  if (groupSize <= 7) return 0.5;       // 50% dilution for medium group
  return 0.3;                            // 70% dilution for large group (8+)
}

/**
 * Calculates event multiplier for special occasions and life events.
 * Peak moments and milestone support create stronger relationship bonds.
 */
export function calculateEventMultiplier(
  category?: InteractionCategory,
  eventImportance?: 'low' | 'medium' | 'high' | 'critical'
): number {
  // Celebration events get boosted based on importance
  if (category === 'celebration') {
    if (eventImportance === 'critical') return 1.5;  // Wedding, major milestone
    if (eventImportance === 'high') return 1.3;      // Birthday, graduation
    if (eventImportance === 'medium') return 1.2;    // Promotion celebration
    return 1.1;                                       // Regular celebration
  }

  // Being there for support during important life events
  if (category === 'favor-support') {
    if (eventImportance === 'critical') return 1.4;  // Crisis support
    if (eventImportance === 'high') return 1.3;      // Major life challenge
    if (eventImportance === 'medium') return 1.2;    // General support
  }

  // Deep talks during important moments
  if (category === 'deep-talk' && eventImportance) {
    if (eventImportance === 'critical' || eventImportance === 'high') return 1.2;
  }

  return 1.0;  // Standard interaction
}

/**
 * Calculates the points for a new interaction.
 * Supports both old activity-based and new category-based systems.
 * Now includes quality-weighted scoring for more nuanced relationship health.
 */
export function calculatePointsForWeave(
  friend: FriendModel,
  weaveData: {
    interactionType?: InteractionType;
    category?: InteractionCategory;
    duration: Duration | null;
    vibe: Vibe | null;
    note?: string | null;
    reflectionJSON?: string | null;
    groupSize?: number;
    eventImportance?: 'low' | 'medium' | 'high' | 'critical';
  }
): number {
  // Calculate current momentum
  const daysSinceMomentumUpdate = (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
  const currentMomentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

  let baseScore: number;
  let archetypeMultiplier: number;

  // NEW: Use category-based scoring if available
  if (weaveData.category) {
    baseScore = CategoryBaseScores[weaveData.category];
    archetypeMultiplier = CategoryArchetypeMatrix[friend.archetype as Archetype][weaveData.category];
  }
  // DEPRECATED: Fall back to old activity-based scoring
  else if (weaveData.interactionType) {
    baseScore = InteractionBaseScores[weaveData.interactionType];
    archetypeMultiplier = ArchetypeMatrixV2[friend.archetype as Archetype][weaveData.interactionType];
  }
  // Default fallback
  else {
    baseScore = 15;
    archetypeMultiplier = 1.0;
  }

  const durationModifier = DurationModifiers[weaveData.duration || 'Standard'];
  const vibeMultiplier = VibeMultipliers[weaveData.vibe || 'WaxingCrescent'];

  // NEW: Calculate group dilution based on interaction size
  const groupDilutionFactor = calculateGroupDilution(weaveData.groupSize || 1);

  // NEW: Calculate event multiplier for special occasions
  const eventMultiplier = calculateEventMultiplier(weaveData.category, weaveData.eventImportance);

  const initialPoints = baseScore * archetypeMultiplier * durationModifier;
  const finalPoints = initialPoints * vibeMultiplier * eventMultiplier * groupDilutionFactor;

  // NEW: Apply quality multiplier based on interaction depth and energy
  const quality = calculateInteractionQuality({
    vibe: weaveData.vibe,
    duration: weaveData.duration,
    note: weaveData.note,
    reflectionJSON: weaveData.reflectionJSON,
  });

  // Quality multiplier ranges from 0.7x to 1.3x
  // - Low quality (1/5): 0.7x
  // - Medium quality (3/5): 1.0x
  // - High quality (5/5): 1.3x
  const qualityMultiplier = 0.7 + (quality.overallQuality / 5) * 0.6;

  // SMART: Quality can partially offset group dilution
  // If you had a big group interaction but reflected deeply on individual moments,
  // that deserves recognition. High quality can restore up to 20% of diluted points.
  const groupSize = weaveData.groupSize || 1;
  let finalDilutionFactor = groupDilutionFactor;
  if (groupSize > 1 && quality.overallQuality >= 4) {
    // High quality (4-5) in group settings: restore 20% of lost points
    const dilutionLoss = 1.0 - groupDilutionFactor; // How much we lost
    const restoration = dilutionLoss * 0.2; // Restore 20%
    finalDilutionFactor = groupDilutionFactor + restoration;
  }

  const qualityAdjustedPoints = finalPoints * qualityMultiplier * (finalDilutionFactor / groupDilutionFactor);

  // NEW v23: Apply learned effectiveness multiplier
  // Blends observed effectiveness with static scoring
  let effectivenessMultiplier = 1.0;
  if (weaveData.category && friend.outcomeCount >= 3) {
    // Only use learned effectiveness after 3+ measured outcomes
    const learnedEffectiveness = getLearnedEffectiveness(friend, weaveData.category);
    const confidence = Math.min(1.0, friend.outcomeCount / 10); // Gain confidence over 10 outcomes

    // Blend static (1.0) with learned effectiveness based on confidence
    effectivenessMultiplier = (1.0 * (1 - confidence)) + (learnedEffectiveness * confidence);
  }

  const adaptivePoints = qualityAdjustedPoints * effectivenessMultiplier;

  // Apply momentum bonus
  if (currentMomentumScore > 0) {
    return adaptivePoints * 1.15;
  }

  return adaptivePoints;
}

/**
 * Check if a weave fulfills any active intentions for a friend
 * Returns the intention if found, null otherwise
 */
async function checkIntentionFulfillment(
  friendId: string,
  category: InteractionCategory | undefined,
  database: Database
): Promise<Intention | null> {
  if (!category) return null;

  try {
    // Get active intentions for this friend through join table
    const intentionFriends = await database
      .get<IntentionFriend>('intention_friends')
      .query(Q.where('friend_id', friendId))
      .fetch();

    if (intentionFriends.length === 0) return null;

    // Get intention IDs
    const intentionIds = intentionFriends.map((ifriend: IntentionFriend) => ifriend._raw.intention_id as string);

    // Find active intentions that match the category (or have no specific category)
    const matchingIntentions = await database
      .get<Intention>('intentions')
      .query(
        Q.where('id', Q.oneOf(intentionIds)),
        Q.where('status', 'active'),
        Q.sortBy('created_at', Q.asc) // Oldest first
      )
      .fetch();

    // Return first matching intention (category match or no category specified)
    for (const intention of matchingIntentions) {
      if (!intention.interactionCategory || intention.interactionCategory === category) {
        return intention;
      }
    }
  } catch (error) {
    console.error('Error checking intention fulfillment:', error);
  }

  return null;
}

/**
 * Logs a new interaction, calculates the new scores, and updates the database in a single transaction.
 * Returns the interaction ID and any badge/achievement unlocks.
 */
export async function logNewWeave(
  friendsToUpdate: FriendModel[],
  weaveData: InteractionFormData,
  database: Database
): Promise<{
  interactionId: string;
  badgeUnlocks: BadgeUnlock[];
  achievementUnlocks: AchievementUnlockData[];
}> {
  let interactionId = '';
  let newInteraction: InteractionModel | null = null;
  const outcomesToCapture: Array<{ friendId: string; scoreBefore: number; expectedImpact: number }> = [];

  await database.write(async () => {
    // 1. Create the Interaction record with the correct data
    newInteraction = await database.get<InteractionModel>('interactions').create(interaction => {
      interaction.interactionDate = weaveData.date;
      interaction.interactionType = weaveData.type; // 'log' or 'plan'
      interaction.activity = weaveData.activity;
      interaction.status = weaveData.status;
      interaction.mode = weaveData.mode;
      interaction.note = weaveData.notes;
      interaction.vibe = weaveData.vibe;
      interaction.duration = weaveData.duration;
      // NEW: Save category if provided
      if (weaveData.category) {
        interaction.interactionCategory = weaveData.category;
      }
      // NEW: Save structured reflection if provided
      if (weaveData.reflection) {
        interaction.reflectionJSON = JSON.stringify(weaveData.reflection);
      }
      // v17: Save title and location if provided
      if (weaveData.title) {
        interaction.title = weaveData.title;
      }
      if (weaveData.location) {
        interaction.location = weaveData.location;
      }
      // v24: Save event importance if provided
      if (weaveData.eventImportance) {
        interaction.eventImportance = weaveData.eventImportance;
      }
      // v25: Save initiator for reciprocity tracking
      if (weaveData.initiator) {
        interaction.initiator = weaveData.initiator;
      }
    });

    interactionId = newInteraction.id;

    for (const friend of friendsToUpdate) {
      // If the weave is just being planned for the future, don't update scores yet.
      if (weaveData.type === 'plan') {
        // Just create the join record and continue to the next friend.
        await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
            ifriend.interactionId = newInteraction!.id;
            ifriend.friendId = friend.id;
        });
        continue; // Skip all the scoring logic
      }

      // 2. Calculate scores using the relevant part of the weaveData
      const currentScore = calculateCurrentScore(friend);

      // v29: Check if this weave fulfills an active intention
      const fulfilledIntention = await checkIntentionFulfillment(
        friend.id,
        weaveData.category as InteractionCategory | undefined,
        database
      );

      let pointsToAdd = calculatePointsForWeave(friend, {
          // NEW: Use category if available, otherwise fall back to old activity
          category: weaveData.category as InteractionCategory | undefined,
          interactionType: weaveData.activity as InteractionType,
          duration: weaveData.duration,
          vibe: weaveData.vibe,
          // NEW: Include quality indicators for quality-weighted scoring
          note: weaveData.notes,
          reflectionJSON: weaveData.reflection ? JSON.stringify(weaveData.reflection) : undefined,
          // v24: Pass group size and event importance for multipliers
          groupSize: friendsToUpdate.length,
          eventImportance: weaveData.eventImportance,
      });

      // v29: Apply intention fulfillment bonus (1.15x, same as momentum)
      if (fulfilledIntention) {
        pointsToAdd = pointsToAdd * 1.15;
        console.log(`[IntentionBonus] Applied 1.15x multiplier for fulfilling intention ${fulfilledIntention.id}`);
      }

      const newWeaveScore = Math.min(100, currentScore + pointsToAdd);

      // 3. Update the friend record with all new scores and states
      await friend.update(record => {
        record.weaveScore = newWeaveScore;
        record.lastUpdated = new Date();

        if (weaveData.vibe) {
          record.ratedWeavesCount += 1;
          if (record.ratedWeavesCount >= 5) {
            let newResilience = record.resilience;
            if (weaveData.vibe === 'WaxingGibbous' || weaveData.vibe === 'FullMoon') {
              newResilience += 0.008;
            } else if (weaveData.vibe === 'NewMoon') {
              newResilience -= 0.005;
            }
            record.resilience = Math.max(0.8, Math.min(1.5, newResilience));
          }
        }

        record.momentumScore = 15;
        record.momentumLastUpdated = new Date();
        record.isDormant = false;
        record.dormantSince = null;
      });

      // 3b. NEW: Learn interaction patterns for adaptive decay (after 5+ interactions)
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();

      if (interactionFriends.length >= 5) {
        // Get all completed interactions for this friend
        const interactionIds = interactionFriends.map((if_: InteractionFriend) => if_.interactionId);
        const friendInteractions = await database
          .get<InteractionModel>('interactions')
          .query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed'),
            Q.sortBy('interaction_date', Q.desc)
          )
          .fetch();

        // Analyze pattern
        const pattern = analyzeInteractionPattern(
          friendInteractions.map(i => ({
            id: i.id,
            interactionDate: i.interactionDate,
            status: i.status,
            category: i.interactionCategory,
          }))
        );

        // Update learned pattern if reliable
        if (isPatternReliable(pattern)) {
          await friend.update(record => {
            record.typicalIntervalDays = pattern.averageIntervalDays;
            record.toleranceWindowDays = calculateToleranceWindow(pattern);
          });
        }
      }

      // 3c. NEW v25: Update reciprocity stats if initiator is specified
      if (weaveData.initiator) {
        await updateInitiationStats(friend, weaveData.initiator as Initiator);
      }

      // 4. Create the join table record
      await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
          ifriend.interactionId = newInteraction!.id;
          ifriend.friendId = friend.id;
      });

      // 4b. v29: Mark intention as fulfilled if this weave fulfilled an intention
      if (fulfilledIntention) {
        const daysSinceCreated = Math.floor(
          (Date.now() - fulfilledIntention.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        );

        await fulfilledIntention.update(intention => {
          intention.status = 'fulfilled';
          intention.linkedInteractionId = newInteraction!.id;
          intention.fulfilledAt = new Date();
          intention.daysToFulfillment = daysSinceCreated;
        });

        console.log(`[IntentionFulfillment] Marked intention ${fulfilledIntention.id} as fulfilled after ${daysSinceCreated} days`);
      }

      // 5. Store outcome data for capture after transaction
      outcomesToCapture.push({
        friendId: friend.id,
        scoreBefore: currentScore,
        expectedImpact: pointsToAdd,
      });
    }

    // 5. Update UserProgress total weaves count (only for completed weaves)
    if (weaveData.type === 'log') {
      const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
      if (userProgressRecords.length > 0) {
        const userProgress = userProgressRecords[0];
        await userProgress.update(up => {
          up.totalWeaves = (up.totalWeaves || 0) + 1;
        });
      }
    }
  });

  // 6. Check for badge and achievement unlocks (after transaction completes)
  const allBadgeUnlocks: BadgeUnlock[] = [];
  const allAchievementUnlocks: AchievementUnlockData[] = [];

  if (weaveData.type === 'log' && newInteraction) {
    // Check badges for each friend
    for (const friend of friendsToUpdate) {
      // Check progressive badges (weave_count, depth, consistency)
      const progressiveBadges = await checkAndAwardFriendBadges(friend.id, friend.name);
      allBadgeUnlocks.push(...progressiveBadges);

      // Check special badges (birthday, phoenix rising, time-based, etc.)
      const specialBadges = await checkSpecialBadges(friend.id, friend.name, newInteraction);
      allBadgeUnlocks.push(...specialBadges);
    }

    // Check global achievements
    const globalUnlocks = await checkAndAwardGlobalAchievements();
    allAchievementUnlocks.push(...globalUnlocks);

    // Check hidden achievements
    const hiddenUnlocks = await checkHiddenAchievements({
      type: 'interaction_logged',
      interaction: newInteraction,
    });
    allAchievementUnlocks.push(...hiddenUnlocks);

    // Check for perfect week (if all friends were contacted in last 7 days)
    // This is an expensive check, so we only do it occasionally
    if (Math.random() < 0.1) {
      // 10% chance to check
      const perfectWeekUnlocks = await checkHiddenAchievements({ type: 'perfect_week' });
      allAchievementUnlocks.push(...perfectWeekUnlocks);
    }

    // Check for renaissance soul (all interaction types used)
    const renaissanceUnlocks = await checkHiddenAchievements({ type: 'interaction_type_used' });
    allAchievementUnlocks.push(...renaissanceUnlocks);
  }

  // 7. Schedule notifications based on interaction type
  if (newInteraction) {
    try {
      const { schedulePostWeaveDeepening, scheduleEventReminder } = await import('./notification-manager-enhanced');

      // For completed weaves: schedule deepening nudge
      if (weaveData.type === 'log' && weaveData.status === 'completed') {
        await schedulePostWeaveDeepening(newInteraction);
      }

      // For planned weaves: schedule event reminder
      if (weaveData.type === 'plan' && weaveData.status === 'planned') {
        await scheduleEventReminder(newInteraction);
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  }

  // 8. NEW v27: Capture interaction outcomes for feedback learning (after transaction completes)
  // This will be measured later to learn effectiveness
  for (const outcome of outcomesToCapture) {
    captureInteractionOutcome(
      interactionId,
      outcome.friendId,
      outcome.scoreBefore,
      outcome.expectedImpact
    ).catch(err => console.warn('Failed to capture interaction outcome:', err));
  }

  // Measure pending outcomes from previous interactions (async, fire-and-forget)
  measurePendingOutcomes().catch(err =>
    console.warn('Failed to measure pending outcomes:', err)
  );

  // Track analytics
  if (weaveData.type === 'log') {
    trackEvent(AnalyticsEvents.INTERACTION_LOGGED, {
      activity: weaveData.activity,
      category: weaveData.category,
      duration: weaveData.duration,
      vibe: weaveData.vibe,
      friends_count: friendsToUpdate.length,
      has_notes: !!weaveData.notes,
      has_reflection: !!weaveData.reflection,
      mode: weaveData.mode,
      status: weaveData.status,
    });
    // Update last interaction timestamp for retention tracking
    updateLastInteractionTimestamp();
  } else if (weaveData.type === 'plan') {
    trackEvent(AnalyticsEvents.INTERACTION_PLANNED, {
      activity: weaveData.activity,
      category: weaveData.category,
      friends_count: friendsToUpdate.length,
      planned_date: weaveData.date.toISOString(),
    });
  }

  return {
    interactionId,
    badgeUnlocks: allBadgeUnlocks,
    achievementUnlocks: allAchievementUnlocks,
  };
}

/**
 * Applies weave scores retroactively when a planned interaction is confirmed as completed.
 * This function is called when users confirm that a planned weave actually happened.
 *
 * @param interactionId - The ID of the interaction to score
 * @param database - WatermelonDB instance
 */
export async function applyScoresForCompletedPlan(interactionId: string, database: Database): Promise<void> {
  await database.write(async () => {
    // 1. Get the interaction
    const interaction = await database.get<InteractionModel>('interactions').find(interactionId);

    // 2. Get all friends associated with this interaction
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query(require('@nozbe/watermelondb').Q.where('interaction_id', interactionId))
      .fetch();

    const friendIds = interactionFriends.map(ifriend => ifriend.friendId);
    const friends = await database
      .get<FriendModel>('friends')
      .query(require('@nozbe/watermelondb').Q.where('id', require('@nozbe/watermelondb').Q.oneOf(friendIds)))
      .fetch();

    // 3. Apply scoring logic for each friend (same as logNewWeave)
    for (const friend of friends) {
      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, {
        category: interaction.interactionCategory as InteractionCategory | undefined,
        interactionType: interaction.activity as InteractionType,
        duration: interaction.duration as Duration | null,
        vibe: interaction.vibe as Vibe | null
      });
      const newWeaveScore = Math.min(100, currentScore + pointsToAdd);

      // 4. Update the friend record
      await friend.update(record => {
        record.weaveScore = newWeaveScore;
        record.lastUpdated = new Date();

        // Update resilience if vibe is set
        if (interaction.vibe) {
          record.ratedWeavesCount += 1;
          if (record.ratedWeavesCount >= 5) {
            let newResilience = record.resilience;
            if (interaction.vibe === 'WaxingGibbous' || interaction.vibe === 'FullMoon') {
              newResilience += 0.008;
            } else if (interaction.vibe === 'NewMoon') {
              newResilience -= 0.005;
            }
            record.resilience = Math.max(0.8, Math.min(1.5, newResilience));
          }
        }

        // Reset momentum
        record.momentumScore = 15;
        record.momentumLastUpdated = new Date();

        // Reactivate if dormant
        record.isDormant = false;
        record.dormantSince = null;
      });
    }

    console.log(`✓ Applied weave scores for completed plan ${interactionId}`);
  });
}