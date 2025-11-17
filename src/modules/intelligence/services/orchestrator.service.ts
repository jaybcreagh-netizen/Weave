// src/modules/intelligence/services/orchestrator.service.ts
import FriendModel from '@/db/models/Friend';
import { InteractionType, InteractionCategory, Duration, Vibe } from '@/components/types';
import { calculatePointsForWeave } from './scoring.service';
import { applyDecay } from './decay.service';

/**
 * Orchestrates all scoring-related calculations for a new interaction.
 * This is the primary entry point for the intelligence module.
 *
 * @param friend - The friend model.
 * @param weaveData - The data for the new weave.
 * @returns The number of points to add for the interaction.
 */
export function processWeaveScoring(
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
  // In the future, this service will coordinate calls to multiple
  // services (e.g., quality, momentum, resilience).
  // For now, it's a direct pass-through to the scoring service.
  const points = calculatePointsForWeave(friend, weaveData);
  return points;
}

/**
 * Calculates the current score of a friend, including decay.
 *
 * @param friend - The friend model.
 * @returns The friend's current score after applying decay.
 */
export function calculateCurrentScore(friend: FriendModel): number {
  const currentScore = applyDecay(friend);
  return currentScore;
}
