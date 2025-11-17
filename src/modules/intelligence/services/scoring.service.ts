// src/modules/intelligence/services/scoring.service.ts
import FriendModel from '@/db/models/Friend';
import { Archetype, Duration, Vibe, InteractionCategory, InteractionType } from '@/components/types';
import {
  CategoryArchetypeMatrix,
  CategoryBaseScores,
  DurationModifiers,
  InteractionBaseScores,
  VibeMultipliers,
  ArchetypeMatrixV2,
} from '../constants';
import { daysSince } from '@/shared/utils/date-utils';
import { getLearnedEffectiveness } from '@/lib/feedback-analyzer';
import { calculateInteractionQuality } from '@/modules/intelligence';

/**
 * Calculates group dilution factor based on the number of people in the interaction.
 * Larger groups mean less individual attention and depth per person.
 * @param {number} groupSize - The number of people in the interaction.
 * @returns {number} The dilution factor.
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
 * @param {InteractionCategory} [category] - The category of the interaction.
 * @param {'low' | 'medium' | 'high' | 'critical'} [eventImportance] - The importance of the event.
 * @returns {number} The event multiplier.
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
 * @param {FriendModel} friend - The friend model.
 * @param weaveData - The weave data.
 * @param {InteractionType} [weaveData.interactionType] - The type of interaction.
 * @param {InteractionCategory} [weaveData.category] - The category of the interaction.
 * @param {Duration | null} weaveData.duration - The duration of the interaction.
 * @param {Vibe | null} weaveData.vibe - The vibe of the interaction.
 * @param {string} [weaveData.note] - The note for the interaction.
 * @param {string} [weaveData.reflectionJSON] - The reflection for the interaction.
 * @param {number} [weaveData.groupSize] - The size of the group.
 * @param {'low' | 'medium' | 'high' | 'critical'} [weaveData.eventImportance] - The importance of the event.
 * @returns {number} The points for the weave.
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
  const daysSinceMomentumUpdate = daysSince(friend.momentumLastUpdated);
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
