import type { SocialSeason } from '@/db/models/UserProfile';
import FriendModel from '@/db/models/Friend';
import { TierDriftingThresholds } from '@/modules/intelligence/constants';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import { daysSince } from '@/shared/utils/date-utils';
import type { Tier } from '../types';

export type TierAwareHealthStatus = 'thriving' | 'stable' | 'attention' | 'drifting';

const HEALTH_SEVERITY: Record<TierAwareHealthStatus, number> = {
  thriving: 0,
  stable: 1,
  attention: 2,
  drifting: 3,
};

/**
 * Tier-aware health bands tuned to keep Circle actionable without feeling naggy.
 * - `drifting`: tier-specific floor from intelligence constants
 * - `attention`: caution zone
 * - `stable`: healthy but watchful
 * - `thriving`: comfortably above tier expectations
 */
const TIER_HEALTH_BANDS = {
  InnerCircle: {
    drifting: TierDriftingThresholds.InnerCircle, // 50
    attention: 60,
    stable: 75,
  },
  CloseFriends: {
    drifting: TierDriftingThresholds.CloseFriends, // 30
    attention: 40,
    stable: 60,
  },
  Community: {
    drifting: TierDriftingThresholds.Community, // 20
    attention: 30,
    stable: 50,
  },
} as const;

const VALID_TIERS: Tier[] = ['InnerCircle', 'CloseFriends', 'Community'];

function normalizeTier(tier: string | null | undefined): Tier {
  if (tier && VALID_TIERS.includes(tier as Tier)) {
    return tier as Tier;
  }
  return 'Community';
}

export function getTierAwareHealthStatus(
  score: number,
  tier: string | null | undefined
): TierAwareHealthStatus {
  const normalizedTier = normalizeTier(tier);
  const thresholds = TIER_HEALTH_BANDS[normalizedTier];

  if (score < thresholds.drifting) return 'drifting';
  if (score < thresholds.attention) return 'attention';
  if (score < thresholds.stable) return 'stable';
  return 'thriving';
}

export function getTierAwareHealthSeverity(
  score: number,
  tier: string | null | undefined
): number {
  return HEALTH_SEVERITY[getTierAwareHealthStatus(score, tier)];
}

export interface FriendPrioritySnapshot {
  friend: FriendModel;
  currentScore: number;
  healthStatus: TierAwareHealthStatus;
  healthSeverity: number;
  lastUpdatedDays: number;
  lastUpdatedMs: number;
}

export function buildFriendPrioritySnapshot(
  friend: FriendModel,
  season?: SocialSeason | null,
  currentScoreOverride?: number
): FriendPrioritySnapshot {
  const currentScore = currentScoreOverride ?? calculateCurrentScore(friend, season);
  const healthStatus = getTierAwareHealthStatus(currentScore, friend.dunbarTier);
  const lastUpdatedMs = friend.lastUpdated instanceof Date ? friend.lastUpdated.getTime() : 0;

  return {
    friend,
    currentScore,
    healthStatus,
    healthSeverity: HEALTH_SEVERITY[healthStatus],
    lastUpdatedDays: daysSince(friend.lastUpdated || new Date(0)),
    lastUpdatedMs,
  };
}

/**
 * Comparison: Needs attention first (for Inner Circle & Close Friends)
 * Sort by worst health → lowest score → oldest interaction → name
 */
export function compareFriendPrioritySnapshots(
  a: FriendPrioritySnapshot,
  b: FriendPrioritySnapshot
): number {
  // Worst health first
  if (a.healthSeverity !== b.healthSeverity) {
    return b.healthSeverity - a.healthSeverity;
  }

  // Then lower score first
  if (a.currentScore !== b.currentScore) {
    return a.currentScore - b.currentScore;
  }

  // Then longest since interaction (oldest update first)
  if (a.lastUpdatedMs !== b.lastUpdatedMs) {
    return a.lastUpdatedMs - b.lastUpdatedMs;
  }

  // Stable deterministic tie-break
  return a.friend.name.localeCompare(b.friend.name);
}

/**
 * Comparison: Recent activity first (for Community tier)
 * Sort by most recent interaction → highest score → name
 * This avoids showing a wall of "drifting" acquaintances which feels guilt-inducing.
 */
export function compareFriendsByRecentActivity(
  a: FriendPrioritySnapshot,
  b: FriendPrioritySnapshot
): number {
  // Most recent interaction first (reversed from needs-attention)
  if (a.lastUpdatedMs !== b.lastUpdatedMs) {
    return b.lastUpdatedMs - a.lastUpdatedMs;
  }

  // Then higher score first (healthier relationships as secondary)
  if (a.currentScore !== b.currentScore) {
    return b.currentScore - a.currentScore;
  }

  // Stable deterministic tie-break
  return a.friend.name.localeCompare(b.friend.name);
}

export function rankFriendsByNeedsAttention(
  friends: FriendModel[],
  season?: SocialSeason | null
): FriendModel[] {
  return friends
    .map(friend => buildFriendPrioritySnapshot(friend, season))
    .sort(compareFriendPrioritySnapshots)
    .map(snapshot => snapshot.friend);
}

export type RankingStrategy = 'needs-attention' | 'recent-activity';

/**
 * Default ranking strategy per tier:
 * - Inner Circle & Close Friends: "needs attention" (actionable, drift matters)
 * - Community: "recent activity" (neutral, non-judgmental - drift is normal here)
 */
const TIER_DEFAULT_STRATEGY: Record<Tier, RankingStrategy> = {
  InnerCircle: 'needs-attention',
  CloseFriends: 'needs-attention',
  Community: 'recent-activity',
};

/**
 * Ranks friends using the default strategy for their tier.
 * - Inner Circle & Close Friends: worst health first (actionable)
 * - Community: most recent first (neutral/non-judgmental)
 */
export function rankFriendsForTier(
  friends: FriendModel[],
  tier: Tier,
  season?: SocialSeason | null
): FriendModel[] {
  const strategy = TIER_DEFAULT_STRATEGY[tier];
  const snapshots = friends.map(friend => buildFriendPrioritySnapshot(friend, season));

  if (strategy === 'recent-activity') {
    snapshots.sort(compareFriendsByRecentActivity);
  } else {
    snapshots.sort(compareFriendPrioritySnapshots);
  }

  return snapshots.map(s => s.friend);
}
