// src/modules/intelligence/services/decay.service.ts
import type Friend from '@/db/models/Friend';
import { TierDecayRates } from '../constants';
import { daysSince } from '@/shared/utils/date-utils';
import { calculateFlexibleDecay } from './flexible-decay.service';
import type { FlexibilityMode } from '@/modules/insights/types';

/**
 * Apply decay to a friend's score
 * Now supports flexible decay based on learned patterns
 *
 * @param friend - The friend to apply decay to
 * @param flexibilityMode - How strict vs flexible to be (default: 'balanced')
 * @param useFlexibleDecay - Whether to use flexible decay system (default: true)
 * @returns Current score after decay
 */
export function applyDecay(
  friend: Friend,
  flexibilityMode: FlexibilityMode = 'balanced',
  useFlexibleDecay: boolean = true
): number {
  const daysSinceLastUpdate = daysSince(friend.lastUpdated);

  // Use flexible decay rate if enabled, otherwise use base tier rate
  const tierDecayRate = useFlexibleDecay
    ? calculateFlexibleDecay(friend, flexibilityMode)
    : TierDecayRates[friend.dunbarTier];

  // Use learned tolerance window if available, otherwise fall back to tier defaults
  const toleranceWindow = friend.toleranceWindowDays || {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier];

  let decayAmount: number;

  if (toleranceWindow && daysSinceLastUpdate <= toleranceWindow) {
    // Within normal pattern - minimal decay (50% of base rate)
    decayAmount = (daysSinceLastUpdate * tierDecayRate * 0.5) / friend.resilience;
  } else {
    // Outside tolerance - accelerating decay
    const safeToleranceWindow = toleranceWindow || 14; // Default to 14 days if undefined
    const excessDays = daysSinceLastUpdate - safeToleranceWindow;
    const baseDecay = (safeToleranceWindow * tierDecayRate * 0.5) / friend.resilience;
    const acceleratedDecay = (excessDays * tierDecayRate * 1.5) / friend.resilience;
    decayAmount = baseDecay + acceleratedDecay;
  }

  return Math.max(0, friend.weaveScore - decayAmount);
}
