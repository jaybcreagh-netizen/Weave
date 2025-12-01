// src/modules/intelligence/services/decay.service.ts
import type FriendModel from '@/db/models/Friend';
import { type Friend } from '@/components/types';
import { TierDecayRates } from '../constants';
import { daysSince } from '@/shared/utils/date-utils';
import { calculateFlexibleDecay } from './flexible-decay.service';
import type { FlexibilityMode } from '@/modules/insights/types';
import type { Tier } from '@/shared/types/common';

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
  friend: FriendModel | Friend,
  flexibilityMode: FlexibilityMode = 'balanced',
  useFlexibleDecay: boolean = true
): number {
  const daysSinceLastUpdate = daysSince(friend.lastUpdated);

  // Use flexible decay rate if enabled, otherwise use base tier rate
  const tierDecayRate = useFlexibleDecay
    ? calculateFlexibleDecay(friend, flexibilityMode)
    : TierDecayRates[friend.dunbarTier as Tier];

  // Use learned tolerance window if available, otherwise fall back to tier defaults
  const toleranceWindow = friend.toleranceWindowDays || {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier as Tier];

  // Guard against invalid resilience values (must be between 0.8 and 1.5)
  const safeResilience = Math.max(0.8, Math.min(1.5, friend.resilience || 1.0));
  if (friend.resilience !== safeResilience) {
    console.warn(`[Decay] Invalid resilience ${friend.resilience} for friend, using ${safeResilience}`);
  }

  let decayAmount: number;

  if (toleranceWindow && daysSinceLastUpdate <= toleranceWindow) {
    // Within normal pattern - minimal decay (50% of base rate)
    decayAmount = (daysSinceLastUpdate * tierDecayRate * 0.5) / safeResilience;
  } else {
    // Outside tolerance - accelerating decay
    const safeToleranceWindow = toleranceWindow || 14; // Default to 14 days if undefined
    const excessDays = daysSinceLastUpdate - safeToleranceWindow;
    const baseDecay = (safeToleranceWindow * tierDecayRate * 0.5) / safeResilience;
    const acceleratedDecay = (excessDays * tierDecayRate * 1.5) / safeResilience;
    decayAmount = baseDecay + acceleratedDecay;
  }

  return Math.max(0, friend.weaveScore - decayAmount);
}
