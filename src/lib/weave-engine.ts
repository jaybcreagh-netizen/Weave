import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { Friend, Interaction, Tier, Archetype, InteractionType, InteractionCategory, Duration, Vibe } from '../components/types';
import { TierDecayRates, InteractionBaseScores, CategoryBaseScores, DurationModifiers, VibeMultipliers, RecencyFactors, ArchetypeMatrixV2, CategoryArchetypeMatrix } from './constants';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { type InteractionFormData } from '../stores/interactionStore';
import { analyzeInteractionPattern, calculateToleranceWindow, isPatternReliable } from './pattern-analyzer';

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

  const eventMultiplier = 1.0; // Hardcoded for Phase 1
  const groupDilutionFactor = 1.0; // Hardcoded for Phase 1

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
  const qualityAdjustedPoints = finalPoints * qualityMultiplier;

  // Apply momentum bonus
  if (currentMomentumScore > 0) {
    return qualityAdjustedPoints * 1.15;
  }

  return qualityAdjustedPoints;
}

/**
 * Logs a new interaction, calculates the new scores, and updates the database in a single transaction.
 */
export async function logNewWeave(friendsToUpdate: FriendModel[], weaveData: InteractionFormData, database: Database): Promise<string> {
  let interactionId = '';

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

      // 4. Create the join table record
      await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
          ifriend.interactionId = newInteraction.id;
          ifriend.friendId = friend.id;
      });
    }
  });

  return interactionId;
}