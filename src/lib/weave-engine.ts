import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { Friend, Interaction, Tier, Archetype, InteractionType, InteractionCategory, Duration, Vibe } from '../components/types';
import { TierDecayRates, InteractionBaseScores, CategoryBaseScores, DurationModifiers, VibeMultipliers, RecencyFactors, ArchetypeMatrixV2, CategoryArchetypeMatrix } from './constants';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { type InteractionFormData } from '../stores/interactionStore';
import { analyzeInteractionPattern, calculateToleranceWindow, isPatternReliable } from './pattern-analyzer';
import { captureInteractionOutcome, measurePendingOutcomes, getLearnedEffectiveness } from './feedback-analyzer';
import { updateInitiationStats, type Initiator } from './reciprocity-analyzer';

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
 * Logs a new interaction, calculates the new scores, and updates the database in a single transaction.
 */
export async function logNewWeave(friendsToUpdate: FriendModel[], weaveData: InteractionFormData, database: Database): Promise<string> {
  let interactionId = '';
  const outcomesToCapture: Array<{ friendId: string; scoreBefore: number; expectedImpact: number }> = [];

  await database.write(async () => {
    // 1. Create the Interaction record with the correct data
    const newInteraction = await database.get<InteractionModel>('interactions').create(interaction => {
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
            ifriend.interactionId = newInteraction.id;
            ifriend.friendId = friend.id;
        });
        continue; // Skip all the scoring logic
      }

      // 2. Calculate scores using the relevant part of the weaveData
      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, {
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
        .get('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();

      if (interactionFriends.length >= 5) {
        // Get all completed interactions for this friend
        const interactionIds = interactionFriends.map(if_ => (if_ as any).interactionId);
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
          ifriend.interactionId = newInteraction.id;
          ifriend.friendId = friend.id;
      });

      // 5. Store outcome data for capture after transaction
      outcomesToCapture.push({
        friendId: friend.id,
        scoreBefore: currentScore,
        expectedImpact: pointsToAdd,
      });
    }
  });

  // 6. NEW v23: Capture interaction outcomes for feedback learning (after transaction completes)
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

  return interactionId;
}