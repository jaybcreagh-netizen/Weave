// src/modules/intelligence/services/flexible-decay.service.ts
import type FriendModel from '@/db/models/Friend';
import { type Friend } from '@/components/types';
import { TierDecayRates } from '../constants';
import { Tier } from '@/shared/types/common';
import type { FlexibilityMode } from '@/modules/insights';

/**
 * Tier expected interaction intervals (in days)
 */
const TIER_EXPECTED_INTERVALS: Record<Tier, number> = {
  InnerCircle: 7,    // Weekly
  CloseFriends: 14,  // Bi-weekly
  Community: 28      // Monthly
};

/**
 * Tier minimum decay rates (floor) - maintains tier hierarchy
 * Never decay slower than 50% of base rate
 */
const TIER_MINIMUM_DECAY: Record<Tier, number> = {
  InnerCircle: 1.25,  // 50% of 2.5
  CloseFriends: 0.75, // 50% of 1.5
  Community: 0.25     // 50% of 0.5
};

/**
 * Flexibility multipliers - how much adjustment is allowed
 */
const FLEXIBILITY_MULTIPLIERS: Record<FlexibilityMode, { min: number; max: number }> = {
  strict: { min: 1.0, max: 1.0 },      // No adjustment
  balanced: { min: 0.5, max: 1.5 },    // 50% adjustment (default)
  flexible: { min: 0.3, max: 2.0 }     // 70% adjustment
};

/**
 * Calculate personalized decay rate for a friend
 * Balances tier expectations with learned personal patterns
 *
 * @param friend - The friend to calculate decay for
 * @param flexibilityMode - How strict vs flexible to be (default: 'balanced')
 * @returns The adjusted decay rate per day
 */
export function calculateFlexibleDecay(
  friend: Friend | FriendModel,
  flexibilityMode: FlexibilityMode = 'balanced'
): number {
  const baseTierDecay = TierDecayRates[friend.dunbarTier as Tier];
  const tierExpectedInterval = TIER_EXPECTED_INTERVALS[friend.dunbarTier as Tier];

  // Guard against invalid tier or corrupted data
  if (!tierExpectedInterval || tierExpectedInterval <= 0 || !baseTierDecay) {
    console.warn(`[FlexibleDecay] Invalid tier data for ${friend.dunbarTier}, using base decay`);
    return baseTierDecay || TierDecayRates.Community; // Fallback to Community tier
  }

  // Use learned pattern if available, otherwise fall back to tier default
  const actualInterval = friend.typicalIntervalDays || tierExpectedInterval;

  // Calculate rhythm adjustment factor
  // If actual interval is longer, decay should be slower (divide by ratio)
  const rhythmRatio = actualInterval / tierExpectedInterval;

  // Get flexibility caps based on mode
  const { min, max } = FLEXIBILITY_MULTIPLIERS[flexibilityMode];

  // Cap adjustment to prevent over-relaxation or over-acceleration
  const cappedRatio = Math.min(Math.max(rhythmRatio, min), max);

  // Apply adjustment: slower decay if actual interval is longer
  let adjustedDecay = baseTierDecay / cappedRatio;

  // Enforce tier floor - maintain minimum decay rate
  const tierMinimum = TIER_MINIMUM_DECAY[friend.dunbarTier as Tier];
  adjustedDecay = Math.max(adjustedDecay, tierMinimum);

  // Ensure tier hierarchy is maintained
  // Inner Circle should always decay faster than Close Friends
  // Close Friends should always decay faster than Community
  adjustedDecay = enforceTierHierarchy(
    adjustedDecay,
    friend.dunbarTier as Tier
  );

  return adjustedDecay;
}

/**
 * Ensure decay rate respects tier hierarchy
 * Inner > Close > Community
 */
function enforceTierHierarchy(
  adjustedDecay: number,
  tier: Tier
): number {
  // Get the tier below's minimum decay rate
  if (tier === 'InnerCircle') {
    // Inner Circle must be at least as fast as Close Friends' max
    const closeFriendsMax = TierDecayRates.CloseFriends;
    return Math.max(adjustedDecay, closeFriendsMax);
  } else if (tier === 'CloseFriends') {
    // Close Friends must be at least as fast as Community's max
    const communityMax = TierDecayRates.Community;
    return Math.max(adjustedDecay, communityMax);
  }

  return adjustedDecay;
}

/**
 * Get expected interval for a tier
 */
export function getTierExpectedInterval(tier: Tier): number {
  return TIER_EXPECTED_INTERVALS[tier];
}

/**
 * Calculate what the decay would be without flexibility
 * (for comparison/display purposes)
 */
export function getBaseDecay(tier: Tier): number {
  return TierDecayRates[tier];
}

/**
 * Calculate the adjustment percentage being applied
 * Returns positive number if decay is slower, negative if faster
 */
export function getDecayAdjustmentPercent(
  friend: FriendModel | Friend,
  flexibilityMode: FlexibilityMode = 'balanced'
): number {
  const baseDecay = getBaseDecay(friend.dunbarTier as Tier);
  const flexibleDecay = calculateFlexibleDecay(friend, flexibilityMode);

  return ((baseDecay - flexibleDecay) / baseDecay) * 100;
}
