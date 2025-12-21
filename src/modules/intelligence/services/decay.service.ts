// src/modules/intelligence/services/decay.service.ts
import type FriendModel from '@/db/models/Friend';
import { type Friend } from '@/shared/types/legacy-types';
import { TierDecayRates, ArchetypeDecayConfigs, getDecayZoneModifier } from '../constants';
import { daysSince } from '@/shared/utils/date-utils';
import { Archetype } from '@/shared/types/legacy-types';
import { getSeasonDecayMultiplier } from './social-season/season-decay.service';
import type { FlexibilityMode } from '@/modules/insights';
import type { Tier } from '@/shared/types/common';
import type { SocialSeason } from '@/db/models/UserProfile';

/**
 * Calculate the amount of decay for a specific number of days
 * Now supports season-aware decay multipliers
 *
 * @param friend - The friend to calculate decay for
 * @param days - Number of days since last interaction
 * @param flexibilityMode - How strict vs flexible to be (default: 'balanced')
 * @param useFlexibleDecay - Whether to use flexible decay system (default: true)
 * @param season - Current social season for decay multiplier (optional)
 * @returns Decay amount to subtract from score
 */
export function calculateDecayAmount(
  friend: FriendModel | Friend,
  days: number,
  // flexibilityMode and useFlexibleDecay are effectively deprecated but kept for signature compatibility if needed,
  // though we will ignore them in the new logic.
  flexibilityMode: FlexibilityMode = 'balanced',
  useFlexibleDecay: boolean = true,
  season?: SocialSeason | null
): number {
  if (days <= 0) return 0;

  // 0. Get Base Rate
  const baseDecayRate = TierDecayRates[friend.dunbarTier as Tier] || TierDecayRates['CloseFriends'];

  // 1. Get Archetype Config
  const archetype = (friend.archetype as Archetype) || 'Unknown';
  const archetypeConfig = ArchetypeDecayConfigs[archetype] ?? ArchetypeDecayConfigs.Unknown;

  // 2. Grace Period Check: No decay if within archetype-specific grace window
  // `lastUpdated` is set to the interaction date when weaves are logged (see orchestrator.service.ts)
  // so it accurately represents "days since last interaction"
  const totalDaysSilent = daysSince(friend.lastUpdated);

  if (totalDaysSilent < archetypeConfig.graceDays) {
    return 0; // Grace period active - no decay yet
  }

  // 3. Apply Archetype Modifier
  const archetypeModifier = Math.min(archetypeConfig.modifier, 1.0);

  // 4. Apply Zone Modifier
  // We use current score to determine the zone
  const zoneModifier = getDecayZoneModifier(friend.weaveScore);

  // 5. Calculate Effective Rate
  let effectiveDecayRate = baseDecayRate * archetypeModifier * zoneModifier;

  // 6. Apply Season Multiplier (Global Tuner)
  if (season) {
    const seasonMultiplier = getSeasonDecayMultiplier(season, friend.dunbarTier as Tier);
    effectiveDecayRate *= seasonMultiplier;
  }

  // 7. Calculate Amount
  const decayAmount = effectiveDecayRate * days;

  return Math.max(0, decayAmount);
}

/**
 * Apply decay to a friend's score
 * Now supports season-aware decay based on user's current social season
 *
 * @param friend - The friend to apply decay to
 * @param flexibilityMode - How strict vs flexible to be (default: 'balanced')
 * @param useFlexibleDecay - Whether to use flexible decay system (default: true)
 * @param season - Current social season for decay multiplier (optional)
 * @returns Current score after decay
 */
export function applyDecay(
  friend: FriendModel | Friend,
  flexibilityMode: FlexibilityMode = 'balanced',
  useFlexibleDecay: boolean = true,
  season?: SocialSeason | null
): number {
  const daysSinceLastUpdate = daysSince(friend.lastUpdated);
  const decayAmount = calculateDecayAmount(friend, daysSinceLastUpdate, flexibilityMode, useFlexibleDecay, season);

  return Math.max(0, friend.weaveScore - decayAmount);
}

