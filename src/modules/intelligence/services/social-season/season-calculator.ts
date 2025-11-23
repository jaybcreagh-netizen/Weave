import {
  SocialSeason,
  SeasonCalculationInput,
  SeasonContext,
  SEASON_THRESHOLDS,
  HYSTERESIS_BUFFER,
} from './season-types';

/**
 * Calculate the social season score (0-100)
 *
 * Scoring breakdown:
 * - Activity Score (60%):
 *   - Recent weave frequency (30%)
 *   - Friend health scores (20%)
 *   - Momentum indicators (10%)
 *
 * - Battery Score (40%):
 *   - Recent battery average (30%)
 *   - Battery trend adjustment (10%)
 */
export function calculateSeasonScore(input: SeasonCalculationInput): number {
  const activityScore = calculateActivityScore(input);
  const batteryScore = calculateBatteryScore(input);

  // Weighted combination: 60% activity, 40% battery
  const finalScore = activityScore * 0.6 + batteryScore * 0.4;

  return Math.max(0, Math.min(100, finalScore));
}

/**
 * Calculate activity score component (0-100)
 */
function calculateActivityScore(input: SeasonCalculationInput): number {
  const {
    weavesLast7Days,
    weavesLast30Days,
    avgScoreAllFriends,
    avgScoreInnerCircle,
    momentumCount,
  } = input;

  // Weave frequency score (0-40 points)
  // Target: 3-4 weaves/week = optimal
  const weeklyRate = weavesLast7Days;
  const frequencyScore = Math.min(40, (weeklyRate / 4) * 40);

  // Monthly consistency score (0-20 points)
  // Rewards sustained activity over time
  const monthlyRate = weavesLast30Days / 4.3; // Approx weeks per month
  const consistencyScore = Math.min(20, (monthlyRate / 4) * 20);

  // Friend health score (0-30 points)
  // Weighted toward Inner Circle health
  const overallHealthScore = (avgScoreAllFriends / 100) * 15;
  const innerCircleHealthScore = (avgScoreInnerCircle / 100) * 15;
  const healthScore = overallHealthScore + innerCircleHealthScore;

  // Momentum bonus (0-10 points)
  // Rewards active connection streaks
  const momentumScore = Math.min(10, momentumCount * 2);

  return frequencyScore + consistencyScore + healthScore + momentumScore;
}

/**
 * Calculate battery score component (0-100)
 */
function calculateBatteryScore(input: SeasonCalculationInput): number {
  const { batteryLast7DaysAvg, batteryTrend } = input;

  // If no battery data, default to neutral score (60)
  if (batteryLast7DaysAvg === null) {
    return 60;
  }

  // Battery average score (0-85 points)
  // Scale 1-5 battery to 0-85 points
  // 1 -> 0, 2 -> 21, 3 -> 42, 4 -> 64, 5 -> 85
  const batteryScore = ((batteryLast7DaysAvg - 1) / 4) * 85;

  // Trend adjustment (+/-15 points)
  let trendAdjustment = 0;
  if (batteryTrend === 'rising') {
    trendAdjustment = 15;
  } else if (batteryTrend === 'falling') {
    trendAdjustment = -15;
  }

  return Math.max(0, Math.min(100, batteryScore + trendAdjustment));
}

/**
 * Calculate social season with hysteresis to prevent rapid switching
 *
 * @param input - Activity and battery metrics
 * @param currentSeason - Current season (null if first calculation)
 * @returns New social season
 */
export function calculateSocialSeason(
  input: SeasonCalculationInput,
  currentSeason: SocialSeason | null = null
): SocialSeason {
  const score = calculateSeasonScore(input);

  // First calculation (no current season) - use strict thresholds
  if (!currentSeason) {
    if (score <= SEASON_THRESHOLDS.resting.max) return 'resting';
    if (score >= SEASON_THRESHOLDS.blooming.min) return 'blooming';
    return 'balanced';
  }

  // Apply hysteresis to prevent rapid oscillation
  // Must cross buffer zone to switch states

  if (currentSeason === 'resting') {
    // Must rise to 50 (46 + buffer) to become Balanced
    if (score >= SEASON_THRESHOLDS.balanced.min + HYSTERESIS_BUFFER) {
      return 'balanced';
    }
    return 'resting';
  }

  if (currentSeason === 'balanced') {
    // Must drop to 40 (45 - buffer) to become Resting
    if (score <= SEASON_THRESHOLDS.resting.max - HYSTERESIS_BUFFER) {
      return 'resting';
    }

    // Must rise to 85 (81 + buffer) to become Blooming
    if (score >= SEASON_THRESHOLDS.blooming.min + HYSTERESIS_BUFFER) {
      return 'blooming';
    }

    return 'balanced';
  }

  if (currentSeason === 'blooming') {
    // Must drop to 76 (80 - buffer) to become Balanced
    if (score <= SEASON_THRESHOLDS.balanced.max - HYSTERESIS_BUFFER) {
      return 'balanced';
    }
    return 'blooming';
  }

  // Fallback (should never reach here)
  return 'balanced';
}

/**
 * Calculate context for adaptive greeting selection
 */
export function calculateSeasonContext(input: SeasonCalculationInput): SeasonContext {
  const {
    weavesLast7Days,
    avgScoreInnerCircle,
    batteryLast7DaysAvg,
  } = input;

  return {
    innerCircleStrong: avgScoreInnerCircle > 70,
    innerCircleWeak: avgScoreInnerCircle < 40,
    highActivity: weavesLast7Days >= 5,
    lowActivity: weavesLast7Days < 2,
    batteryLow: batteryLast7DaysAvg !== null && batteryLast7DaysAvg < 2.5,
    batteryHigh: batteryLast7DaysAvg !== null && batteryLast7DaysAvg > 4.0,
  };
}
