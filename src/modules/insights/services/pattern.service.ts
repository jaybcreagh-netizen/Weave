import { differenceInDays } from 'date-fns';
import { InteractionCategory } from '@/shared/types/common';

/**
 * Represents the learned interaction pattern for a friendship
 */
export interface FriendshipPattern {
  averageIntervalDays: number;
  consistency: number; // 0-1, how regular are the interactions?
  preferredCategories: InteractionCategory[];
  preferredDayOfWeek?: number; // 0-6 (Sun-Sat)
  lastPatternUpdate: Date;
  sampleSize: number; // How many interactions this is based on
}

/**
 * Interaction data needed for pattern analysis
 */
export interface PatternInteractionData {
  id: string;
  interactionDate: Date;
  status: string;
  category?: InteractionCategory | string | null;
  friendCount?: number; // Number of friends in this interaction (for filtering)
}

/**
 * Options for pattern analysis filtering
 */
export interface PatternAnalysisOptions {
  /**
   * Filter to only include "primary" interactions (small groups of 1-3 friends).
   * This gives a more accurate picture of personal rhythm vs group events.
   * Default: false (include all interactions)
   */
  primaryOnly?: boolean;

  /**
   * Maximum number of friends to consider an interaction "primary".
   * Only used when primaryOnly is true.
   * Default: 3
   */
  primaryMaxFriends?: number;
}

/**
 * Analyzes a friend's interaction history to detect their natural rhythm
 * and preferences. This enables personalized suggestions and adaptive decay.
 *
 * @param interactions - Array of completed interactions, sorted newest to oldest
 * @param options - Optional filtering options for pattern analysis
 * @returns FriendshipPattern with learned characteristics
 */
export function analyzeInteractionPattern(
  interactions: PatternInteractionData[],
  options: PatternAnalysisOptions = {}
): FriendshipPattern {
  const { primaryOnly = false, primaryMaxFriends = 3 } = options;

  // Filter to only completed interactions with valid dates
  let completed = interactions
    .filter(i => i.status === 'completed' && i.interactionDate && !isNaN(i.interactionDate.getTime()));

  // Apply primary-only filter if requested (small group interactions)
  if (primaryOnly) {
    completed = completed.filter(i =>
      i.friendCount === undefined || i.friendCount <= primaryMaxFriends
    );
  }

  completed = completed.sort((a, b) => b.interactionDate.getTime() - a.interactionDate.getTime());

  // Need at least 2 interactions to establish a pattern
  if (completed.length < 2) {
    return getDefaultPattern();
  }

  // Calculate intervals between consecutive interactions
  const intervals: number[] = [];
  for (let i = 0; i < completed.length - 1; i++) {
    const days = Math.abs(differenceInDays(
      completed[i].interactionDate,
      completed[i + 1].interactionDate
    ));
    // Only include reasonable intervals (filter out same-day duplicates)
    if (days > 0) {
      intervals.push(days);
    }
  }

  // If we don't have valid intervals, return default
  if (intervals.length === 0) {
    return getDefaultPattern();
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

  // Calculate consistency score (lower variance = more consistent)
  const variance = intervals.reduce((sum, i) =>
    sum + Math.pow(i - avgInterval, 2), 0
  ) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Consistency: 1.0 = perfectly regular, 0.0 = completely random
  // We normalize by average to make it scale-invariant
  const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1;
  const consistency = Math.max(0, Math.min(1, 1 - coefficientOfVariation));

  // Find preferred interaction categories
  const categoryCounts = new Map<InteractionCategory, number>();
  completed.forEach(i => {
    if (i.category) {
      const cat = i.category as InteractionCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
  });

  const preferredCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => cat);

  // Detect preferred day of week (if there's a pattern)
  const dayOfWeekCounts = new Array(7).fill(0);
  completed.forEach(i => {
    const dayOfWeek = i.interactionDate.getDay();
    dayOfWeekCounts[dayOfWeek]++;
  });

  const maxDayCount = Math.max(...dayOfWeekCounts);
  const preferredDayOfWeek = maxDayCount >= completed.length * 0.3 // 30% threshold
    ? dayOfWeekCounts.indexOf(maxDayCount)
    : undefined;

  return {
    averageIntervalDays: Math.round(avgInterval),
    consistency,
    preferredCategories,
    preferredDayOfWeek,
    lastPatternUpdate: new Date(),
    sampleSize: completed.length,
  };
}

/**
 * Returns a default pattern for new friendships with no interaction history
 */
function getDefaultPattern(): FriendshipPattern {
  return {
    averageIntervalDays: 14, // Default to bi-weekly
    consistency: 0,
    preferredCategories: [],
    preferredDayOfWeek: undefined,
    lastPatternUpdate: new Date(),
    sampleSize: 0,
  };
}

/**
 * Determines if a pattern is reliable enough to use for suggestions
 *
 * @param pattern - The friendship pattern to evaluate
 * @returns true if pattern has enough data to be actionable
 */
export function isPatternReliable(pattern: FriendshipPattern): boolean {
  // Lowered thresholds: Need at least 2 interactions and some level of consistency (0.2)
  // This allows patterns to emerge earlier and encourages continued use
  return pattern.sampleSize >= 2 && pattern.consistency > 0.2;
}

/**
 * Calculates when the next interaction is "expected" based on the pattern
 *
 * @param lastInteractionDate - Date of most recent interaction
 * @param pattern - The learned friendship pattern
 * @returns Expected date of next interaction
 */
export function predictNextInteraction(
  lastInteractionDate: Date,
  pattern: FriendshipPattern
): Date {
  const nextDate = new Date(lastInteractionDate);
  nextDate.setDate(nextDate.getDate() + pattern.averageIntervalDays);
  return nextDate;
}

/**
 * Calculates a "tolerance window" - how long before we should suggest reconnecting
 *
 * @param pattern - The learned friendship pattern
 * @returns Number of days to wait before suggesting reconnection
 */
export function calculateToleranceWindow(pattern: FriendshipPattern): number {
  if (!isPatternReliable(pattern)) {
    // No reliable pattern, use conservative default
    return Math.round(pattern.averageIntervalDays * 1.2);
  }

  // For reliable patterns, adjust based on consistency
  // High consistency = tight window, low consistency = loose window
  const baseMultiplier = 1.2;
  const consistencyAdjustment = (1 - pattern.consistency) * 0.5; // 0 to 0.5
  const multiplier = baseMultiplier + consistencyAdjustment;

  return Math.round(pattern.averageIntervalDays * multiplier);
}

/**
 * Gets a human-readable description of the pattern for UI display
 *
 * @param pattern - The friendship pattern
 * @returns Human-readable description
 */
export function getPatternDescription(pattern: FriendshipPattern): string {
  if (!isPatternReliable(pattern)) {
    return '';
  }

  const intervalText = pattern.averageIntervalDays === 1
    ? 'daily'
    : pattern.averageIntervalDays === 7
      ? 'weekly'
      : pattern.averageIntervalDays === 14
        ? 'bi-weekly'
        : pattern.averageIntervalDays === 30
          ? 'monthly'
          : `every ${pattern.averageIntervalDays} days`;

  return `You usually connect ${intervalText}`;
}

/**
 * Converts a day interval into a human-readable frequency description
 * 
 * @param days - Average interval in days
 * @returns Short description like "Weekly", "Monthly", "Every 3d"
 */
export function getIntervalDescription(days: number): string {
  const rounded = Math.round(days);

  if (rounded <= 1) return 'Daily';
  if (rounded === 7) return 'Weekly';
  if (rounded === 14) return 'Bi-weekly';
  if (rounded === 30 || rounded === 31) return 'Monthly';
  if (rounded === 90) return 'Quarterly';
  if (rounded === 365) return 'Yearly';

  return `Every ${rounded} days`;
}
