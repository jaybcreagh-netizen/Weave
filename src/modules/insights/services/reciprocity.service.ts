import FriendModel from '@/db/models/Friend';
import { clamp, FRIEND_VALIDATION_BOUNDS } from '@/shared/utils/validation-helpers';

/**
 * Type definition for who initiated an interaction
 */
export type Initiator = 'user' | 'friend' | 'mutual';

/**
 * Constants for validation bounds
 */
const MAX_CONSECUTIVE_INITIATIONS = FRIEND_VALIDATION_BOUNDS.consecutiveUserInitiations.max;
const MIN_RATIO = FRIEND_VALIDATION_BOUNDS.initiationRatio.min;
const MAX_RATIO = FRIEND_VALIDATION_BOUNDS.initiationRatio.max;

/**
 * Reciprocity analysis results for a friend
 */
export interface ReciprocityAnalysis {
  initiationRatio: number; // 0-1 (0 = always friend, 1 = always user, 0.5 = balanced)
  totalInitiations: number;
  userInitiations: number;
  friendInitiations: number;
  consecutiveUserInitiations: number;
  lastInitiatedBy?: Initiator;
  balance: 'balanced' | 'slightly-imbalanced' | 'very-imbalanced' | 'one-sided';
  warning?: string;
}

/**
 * Imbalance severity levels
 */
export type ImbalanceLevel = 'none' | 'mild' | 'moderate' | 'severe';

/**
 * Updates a friend's initiation statistics after logging a new interaction
 */
export async function updateInitiationStats(
  friend: FriendModel,
  initiator: Initiator
): Promise<void> {
  await friend.update(record => {
    // Validate current values are non-negative (data integrity check)
    if (record.totalUserInitiations < 0) {
      console.warn('[ReciprocityAnalyzer] Negative totalUserInitiations detected, resetting to 0');
      record.totalUserInitiations = 0;
    }
    if (record.totalFriendInitiations < 0) {
      console.warn('[ReciprocityAnalyzer] Negative totalFriendInitiations detected, resetting to 0');
      record.totalFriendInitiations = 0;
    }
    if (record.consecutiveUserInitiations < 0) {
      console.warn('[ReciprocityAnalyzer] Negative consecutiveUserInitiations detected, resetting to 0');
      record.consecutiveUserInitiations = 0;
    }

    // Update counters
    if (initiator === 'user') {
      record.totalUserInitiations += 1;
      // Cap consecutive initiations to prevent overflow
      record.consecutiveUserInitiations = Math.min(
        record.consecutiveUserInitiations + 1,
        MAX_CONSECUTIVE_INITIATIONS
      );
    } else if (initiator === 'friend') {
      record.totalFriendInitiations += 1;
      record.consecutiveUserInitiations = 0; // Reset streak
    } else if (initiator === 'mutual') {
      // Count as half for each party
      record.totalUserInitiations += 0.5;
      record.totalFriendInitiations += 0.5;
      record.consecutiveUserInitiations = 0; // Reset streak
    }

    // Calculate new ratio with bounds checking
    const total = record.totalUserInitiations + record.totalFriendInitiations;
    if (total > 0) {
      const rawRatio = record.totalUserInitiations / total;
      // Clamp ratio to valid range (0.0-1.0) to prevent floating point errors
      record.initiationRatio = clamp(rawRatio, MIN_RATIO, MAX_RATIO);

      // Paranoid check: if ratio is NaN or Infinity, reset to balanced
      if (!Number.isFinite(record.initiationRatio)) {
        console.error('[ReciprocityAnalyzer] Invalid ratio calculated, resetting to 0.5');
        record.initiationRatio = 0.5;
      }
    } else {
      // No interactions yet, default to balanced
      record.initiationRatio = 0.5;
    }

    // Update last initiator
    record.lastInitiatedBy = initiator;
  });
}

/**
 * Analyzes the reciprocity balance of a friendship
 */
export function analyzeReciprocity(friend: FriendModel): ReciprocityAnalysis {
  // Ensure values are non-negative (data integrity)
  const userInitiations = Math.max(0, friend.totalUserInitiations);
  const friendInitiations = Math.max(0, friend.totalFriendInitiations);
  const totalInitiations = userInitiations + friendInitiations;

  // Clamp ratio to valid range and handle edge cases
  let ratio = clamp(friend.initiationRatio, MIN_RATIO, MAX_RATIO);

  // If ratio is invalid (NaN, Infinity), recalculate from totals
  if (!Number.isFinite(ratio)) {
    if (totalInitiations > 0) {
      ratio = clamp(userInitiations / totalInitiations, MIN_RATIO, MAX_RATIO);
    } else {
      ratio = 0.5; // Default to balanced
    }
  }

  // Determine balance level
  let balance: ReciprocityAnalysis['balance'];
  let warning: string | undefined;

  if (totalInitiations < 3) {
    // Not enough data yet
    balance = 'balanced';
  } else if (ratio >= 0.4 && ratio <= 0.6) {
    // 40-60% range = balanced
    balance = 'balanced';
  } else if (ratio >= 0.3 && ratio < 0.4 || ratio > 0.6 && ratio <= 0.7) {
    // 30-40% or 60-70% = slightly imbalanced
    balance = 'slightly-imbalanced';
  } else if (ratio >= 0.2 && ratio < 0.3 || ratio > 0.7 && ratio <= 0.8) {
    // 20-30% or 70-80% = very imbalanced
    balance = 'very-imbalanced';
    warning = ratio > 0.5
      ? `You've initiated ${Math.round(ratio * 100)}% of interactions with ${friend.name}`
      : `${friend.name} has initiated ${Math.round((1 - ratio) * 100)}% of interactions`;
  } else {
    // < 20% or > 80% = one-sided
    balance = 'one-sided';
    if (ratio > 0.8) {
      warning = `⚠️ One-sided relationship: You've initiated ${friend.consecutiveUserInitiations} interactions in a row with ${friend.name}`;
    } else {
      warning = `${friend.name} rarely initiates contact (${Math.round(ratio * 100)}% you, ${Math.round((1 - ratio) * 100)}% them)`;
    }
  }

  // Ensure consecutive initiations is non-negative and within bounds
  const consecutiveUserInitiations = clamp(
    friend.consecutiveUserInitiations,
    0,
    MAX_CONSECUTIVE_INITIATIONS
  );

  return {
    initiationRatio: ratio,
    totalInitiations,
    userInitiations,
    friendInitiations,
    consecutiveUserInitiations,
    lastInitiatedBy: friend.lastInitiatedBy as Initiator | undefined,
    balance,
    warning,
  };
}

/**
 * Detects if a friendship has an unhealthy initiation imbalance
 */
export function detectImbalance(friend: FriendModel): ImbalanceLevel {
  const analysis = analyzeReciprocity(friend);
  const totalInitiations = analysis.totalInitiations;

  // Need at least 5 interactions to make a judgment
  if (totalInitiations < 5) return 'none';

  const ratio = analysis.initiationRatio;
  const consecutiveInitiations = analysis.consecutiveUserInitiations; // Use validated value

  // Severe: > 85% one-sided AND 5+ consecutive user initiations
  if ((ratio > 0.85 || ratio < 0.15) && consecutiveInitiations >= 5) {
    return 'severe';
  }

  // Moderate: 75-85% one-sided
  if (ratio > 0.75 || ratio < 0.25) {
    return 'moderate';
  }

  // Mild: 65-75% imbalanced
  if (ratio > 0.65 || ratio < 0.35) {
    return 'mild';
  }

  return 'none';
}

/**
 * Gets a human-readable description of the reciprocity status
 */
export function getReciprocityDescription(analysis: ReciprocityAnalysis): string {
  if (analysis.totalInitiations < 3) {
    return 'Not enough data yet to assess balance';
  }

  const percent = Math.round(analysis.initiationRatio * 100);

  switch (analysis.balance) {
    case 'balanced':
      return `Healthy balance (${percent}% you, ${100 - percent}% them)`;
    case 'slightly-imbalanced':
      return `Slightly imbalanced (${percent}% you, ${100 - percent}% them)`;
    case 'very-imbalanced':
      return `Very imbalanced (${percent}% you, ${100 - percent}% them)`;
    case 'one-sided':
      return `One-sided relationship (${percent}% you, ${100 - percent}% them)`;
    default:
      return '';
  }
}

/**
 * Calculates a reciprocity score (0-1, where 1 = perfectly balanced)
 * This can be used to adjust suggestion priorities
 */
export function calculateReciprocityScore(friend: FriendModel): number {
  const analysis = analyzeReciprocity(friend);

  if (analysis.totalInitiations < 3) {
    return 1.0; // Neutral until we have data
  }

  // Score is 1.0 at perfect balance (0.5), decreases as it becomes one-sided
  const deviation = Math.abs(analysis.initiationRatio - 0.5);
  const score = 1.0 - (deviation * 2); // deviation ranges 0-0.5, so * 2 gives us 0-1

  return Math.max(0, score);
}
