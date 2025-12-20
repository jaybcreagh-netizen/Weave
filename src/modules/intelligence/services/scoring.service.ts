// src/modules/intelligence/services/scoring.service.ts
import FriendModel from '@/db/models/Friend';
import { Archetype, Duration, Vibe, InteractionCategory, InteractionType } from '@/shared/types/legacy-types';
import {
  CategoryArchetypeMatrix,
  CategoryBaseScores,
  DurationModifiers,
  InteractionBaseScores,
  VibeMultipliers,
  ArchetypeMatrixV2,
  MAX_INTERACTION_SCORE,
  GROUP_DILUTION_RATE,
  GROUP_DILUTION_FLOOR,
  OLIVE_BRANCH_BONUS,
  OLIVE_BRANCH_ELIGIBLE_STATES,
  TierDriftingThresholds,
  GROUP_IMMUNE_ARCHETYPES,
} from '../constants';
import { daysSince } from '@/shared/utils/date-utils';
import { getLearnedEffectiveness } from '@/modules/insights';
import { calculateInteractionQuality } from '../services/quality.service';

/**
 * Calculates group dilution factor based on the number of people in the interaction.
 * Uses a smooth logarithmic curve instead of discrete buckets for more natural scaling.
 *
 * Formula: max(FLOOR, 1 / (1 + RATE * ln(groupSize)))
 *
 * This produces a gradual decline:
 * - groupSize 1: 1.0 (no dilution)
 * - groupSize 2: ~0.87
 * - groupSize 3: ~0.79
 * - groupSize 4: ~0.74
 * - groupSize 5: ~0.70
 * - groupSize 8: ~0.58
 * - groupSize 15: ~0.49
 * - groupSize 30+: approaches floor (0.25)
 *
 * @param {number} groupSize - The number of people in the interaction.
 * @returns {number} The dilution factor (between GROUP_DILUTION_FLOOR and 1.0).
 */
export function calculateGroupDilution(groupSize: number): number {
  // Handle edge cases
  if (groupSize <= 0) return 1.0;
  if (groupSize === 1) return 1.0;

  // Smooth logarithmic curve: 1 / (1 + rate * ln(groupSize))
  const dilution = 1 / (1 + GROUP_DILUTION_RATE * Math.log(groupSize));

  // Enforce floor to ensure group interactions always have some value
  return Math.max(GROUP_DILUTION_FLOOR, dilution);
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
    interactionHistoryCount?: number; // NEW: Count of prior interactions of this type/category
    ignoreMomentum?: boolean; // NEW: For deletion/reversion logic
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
    const matrix = CategoryArchetypeMatrix[friend.archetype as Archetype];
    archetypeMultiplier = matrix ? matrix[weaveData.category] : 1.0;
  }
  // DEPRECATED: Fall back to old activity-based scoring
  else if (weaveData.interactionType) {
    baseScore = InteractionBaseScores[weaveData.interactionType];
    const matrix = ArchetypeMatrixV2[friend.archetype as Archetype];
    archetypeMultiplier = matrix ? matrix[weaveData.interactionType] : 1.0;
  }
  // Default fallback
  else {
    baseScore = 15;
    archetypeMultiplier = 1.0;
  }

  const durationModifier = DurationModifiers[weaveData.duration || 'Standard'];
  const vibeMultiplier = VibeMultipliers[weaveData.vibe || 'WaxingCrescent'];

  // NEW: Calculate group dilution based on interaction size
  // Sun, Lovers, and Magician are immune to group dilution (they thrive in crowds)
  let groupDilutionFactor = calculateGroupDilution(weaveData.groupSize || 1);

  if (GROUP_IMMUNE_ARCHETYPES.includes(friend.archetype as Archetype)) {
    groupDilutionFactor = 1.0;
  }

  // NEW: Calculate event multiplier for special occasions
  const eventMultiplier = calculateEventMultiplier(weaveData.category, weaveData.eventImportance);

  // NEW: Affinity Bonus (Frequency Multiplier)
  // If you've done this specific activity 5+ times with this friend, it's a "favorite"
  // and gets a 1.15x bonus.
  let affinityMultiplier = 1.0;
  if ((weaveData.interactionHistoryCount || 0) >= 5) {
    affinityMultiplier = 1.15;
  }

  const initialPoints = baseScore * archetypeMultiplier * durationModifier;
  const intermediatePoints = initialPoints * vibeMultiplier * eventMultiplier * groupDilutionFactor * affinityMultiplier;

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
  const safeQuality = Math.max(1, Math.min(5, quality.overallQuality));
  const qualityMultiplier = 0.7 + (safeQuality / 5) * 0.6;

  // SMART: Quality can partially offset group dilution
  // If you had a big group interaction but reflected deeply on individual moments,
  // that deserves recognition. High quality can restore up to 20% of diluted points.
  const groupSize = weaveData.groupSize || 1;
  let finalDilutionFactor = groupDilutionFactor;
  if (groupSize > 1 && safeQuality >= 4) {
    // High quality (4-5) in group settings: restore 20% of lost points
    const dilutionLoss = 1.0 - groupDilutionFactor; // How much we lost
    const restoration = dilutionLoss * 0.2; // Restore 20%
    finalDilutionFactor = groupDilutionFactor + restoration;
  }

  const qualityAdjustedPoints = intermediatePoints * qualityMultiplier * (finalDilutionFactor / groupDilutionFactor);

  // NEW v23: Apply learned effectiveness multiplier
  // Blends observed effectiveness with static scoring
  let effectivenessMultiplier = 1.0;
  const safeOutcomeCount = Math.max(0, friend.outcomeCount);
  if (weaveData.category && safeOutcomeCount >= 3) {
    // Only use learned effectiveness after 3+ measured outcomes
    const learnedEffectiveness = getLearnedEffectiveness(friend, weaveData.category);
    const confidence = Math.min(1.0, safeOutcomeCount / 10); // Gain confidence over 10 outcomes

    // Blend static (1.0) with learned effectiveness based on confidence
    effectivenessMultiplier = (1.0 * (1 - confidence)) + (learnedEffectiveness * confidence);
  }

  const adaptivePoints = qualityAdjustedPoints * effectivenessMultiplier;

  // Apply momentum bonus
  let finalPoints = adaptivePoints;
  if (!weaveData.ignoreMomentum && currentMomentumScore > 0) {
    finalPoints = adaptivePoints * 1.15;
  }

  // NEW: Olive Branch Bonus
  // Flat bonus for reconnecting with Drifting or Dormant friends
  // This is additive to the calculated score
  const currentState = getFriendScoringState(friend);
  const { OLIVE_BRANCH_ELIGIBLE_STATES, OLIVE_BRANCH_BONUS } = require('../constants'); // Import constants

  if (OLIVE_BRANCH_ELIGIBLE_STATES.includes(currentState)) {
    // Bonus applied!
    finalPoints += OLIVE_BRANCH_BONUS;

    // NOTE: We deliberately allow this bonus to exceed the standard interaction max slightly
    // to make re-connection feel powerful. But we still want a sanity cap.
    // If standard max is 50, and bonus is 30, a perfect interaction could be 50+30=80.
    // We'll return here to strict capping, but modify the cap logic below if needed.
    // User request: "New score: 103" implies friend score, not interaction score.
    // User scenario B: "Total points earned: 75".
    // So we need to let it break the 50 cap.
    return Math.min(finalPoints, MAX_INTERACTION_SCORE + OLIVE_BRANCH_BONUS);
  }

  // Apply score capping to prevent extreme outliers
  // This ensures that even with perfect conditions, scores remain balanced
  return Math.min(finalPoints, MAX_INTERACTION_SCORE);
}

/**
 * Determines the current scoring state of a friend for bonus eligibility.
 * @param friend - The friend to check.
 * @returns 'Thriving' | 'Drifting' | 'Dormant'
 */
export function getFriendScoringState(friend: FriendModel): 'Thriving' | 'Drifting' | 'Dormant' {
  // 1. Check Dormant (Global threshold from Decay Zones)
  // Zone 3 covers 0-14, so < 15 is dormant/lowest zone
  if (friend.weaveScore < 15) return 'Dormant';

  // 2. Check Drifting (Tier-specific thresholds)
  const tier = (friend.dunbarTier || 'Community') as keyof typeof TierDriftingThresholds;
  const driftThreshold = TierDriftingThresholds[tier] || 20;

  if (friend.weaveScore < driftThreshold) return 'Drifting';

  return 'Thriving';
}
