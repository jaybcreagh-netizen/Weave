// src/modules/intelligence/services/decay.service.ts
import type Friend from '@/db/models/Friend';
import { TierDecayRates } from '@/shared/constants/constants';
import { daysSince } from '@/shared/utils/date-utils';

export function applyDecay(friend: Friend): number {
  const daysSinceLastUpdate = daysSince(friend.lastUpdated);
  const tierDecayRate = TierDecayRates[friend.dunbarTier];

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
