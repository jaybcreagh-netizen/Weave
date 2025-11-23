import type Friend from '@/db/models/Friend';
import { daysSince } from '@/shared/utils/date-utils';

/**
 * Calculates a points bonus based on the friend's current momentum.
 * A decaying momentum score provides a bonus if the last interaction was recent.
 *
 * @param friend - The friend model instance.
 * @returns A multiplier for the points earned.
 */
export function calculateMomentumBonus(friend: Friend): number {
  const momentumScore = friend.momentumScore || 0;
  const lastUpdate = friend.momentumLastUpdated;

  if (!lastUpdate) {
    return 1.0; // No momentum history, no bonus.
  }

  const days = daysSince(lastUpdate);

  // The momentum score (e.g., 15) decays over time.
  // Let's assume a simple decay rate for now, like 1 point per day.
  const decayedMomentum = Math.max(0, momentumScore - days);

  // If momentum is still active, provide a bonus.
  // Let's define a simple bonus: 15% if there's any momentum left.
  if (decayedMomentum > 0) {
    return 1.15;
  }

  return 1.0;
}

/**
 * Updates the friend's momentum score after an interaction.
 * Resets the momentum score to a baseline value.
 *
 * @param friend - The friend model instance to be updated.
 * @returns The new momentum score.
 */
export function updateMomentum(_friend: Friend): { momentumScore: number; momentumLastUpdated: Date } {
  // The logic from weave-engine.ts simply resets the momentum.
  const newMomentumScore = 15;

  return {
    momentumScore: newMomentumScore,
    momentumLastUpdated: new Date(),
  };
}
