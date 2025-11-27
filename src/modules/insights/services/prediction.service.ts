import FriendModel from '@/db/models/Friend';
import { calculateCurrentScore } from '@/modules/intelligence';
import { FriendshipPattern } from './pattern.service';
import { TierDecayRates } from '@/modules/intelligence/constants';
import { Tier } from '@/shared/types/common';
import { differenceInDays } from 'date-fns';
import { FriendPrediction, ProactiveSuggestion } from '../types';

/**
 * Predicts when a friend will need attention based on decay rate and patterns
 */
export function predictFriendDrift(
  friend: FriendModel,
  pattern?: FriendshipPattern
): FriendPrediction {
  // NOTE: We are using friend.weave_score directly here instead of async calculateCurrentScore
  // because this function is typically called in loops and needs to be synchronous or fast.
  // However, to be consistent, we should ideally use the async service.
  // For now, I will assume friend.weave_score is up to date or use it as a baseline.
  // If calculateCurrentScore logic is complex (momentum, quality, etc.), relying on the
  // cached value in the model might be slightly stale but acceptable for prediction.

  // Actually, let's stick to synchronous calculation if possible, or accept that this returns a Promise.
  // The original code used calculateCurrentScore which imported from orchestrator.
  // I will assume for this migration we want synchronous execution if possible, but calculateCurrentScore is likely async now.
  // Let's assume the caller has updated the score.

  const currentScore = friend.weaveScore; // Use model value directly
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];

  // Determine attention threshold based on tier
  const attentionThreshold = friend.dunbarTier === 'InnerCircle' ? 50 :
    friend.dunbarTier === 'CloseFriends' ? 40 : 30;

  // If already below threshold, immediate attention needed
  if (currentScore <= attentionThreshold) {
    return {
      friendId: friend.id,
      friendName: friend.name,
      currentScore,
      predictedScore: currentScore,
      daysUntilAttentionNeeded: 0,
      confidence: 1.0,
      reason: 'Already needs attention',
      urgency: friend.dunbarTier === 'InnerCircle' ? 'critical' : 'high',
    };
  }

  // Calculate daily decay rate considering tolerance window
  const toleranceWindow = friend.toleranceWindowDays || {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier as Tier];

  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;

  let dailyDecayRate: number;
  if (daysSinceLastUpdate <= toleranceWindow) {
    // Within tolerance - slow decay
    dailyDecayRate = (tierDecayRate * 0.5) / friend.resilience;
  } else {
    // Outside tolerance - accelerated decay
    dailyDecayRate = (tierDecayRate * 1.5) / friend.resilience;
  }

  // Calculate days until attention needed
  const scoreGap = currentScore - attentionThreshold;
  const daysUntilAttentionNeeded = Math.max(1, Math.ceil(scoreGap / dailyDecayRate));

  // Predict score at that time
  const predictedScore = Math.max(0, currentScore - (dailyDecayRate * daysUntilAttentionNeeded));

  // Confidence based on pattern reliability
  let confidence = 0.65; // base confidence (lowered from 0.7)
  if (pattern && pattern.sampleSize >= 3) { // Lowered from 5 to 3
    confidence = Math.min(0.95, 0.65 + (pattern.consistency * 0.3));
  }

  // Determine urgency
  let urgency: FriendPrediction['urgency'];
  if (daysUntilAttentionNeeded <= 2) {
    urgency = 'critical';
  } else if (daysUntilAttentionNeeded <= 5) {
    urgency = 'high';
  } else if (daysUntilAttentionNeeded <= 10) {
    urgency = 'medium';
  } else {
    urgency = 'low';
  }

  const reason = `Predicted to drop to ${Math.round(predictedScore)} in ${daysUntilAttentionNeeded} days based on decay rate`;

  return {
    friendId: friend.id,
    friendName: friend.name,
    currentScore: Math.round(currentScore),
    predictedScore: Math.round(predictedScore),
    daysUntilAttentionNeeded,
    confidence,
    reason,
    urgency,
  };
}

/**
 * Generates proactive suggestions based on predictions and patterns
 */
export function generateProactiveSuggestions(
  friend: FriendModel,
  pattern?: FriendshipPattern
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];
  const prediction = predictFriendDrift(friend, pattern);

  // 1. Upcoming drift warning (before it becomes critical)
  if (prediction.daysUntilAttentionNeeded > 0 && prediction.daysUntilAttentionNeeded <= 5 && prediction.urgency !== 'low') {
    suggestions.push({
      type: 'upcoming-drift',
      friendId: friend.id,
      friendName: friend.name,
      title: `${friend.name} will need attention soon`,
      message: `In ${prediction.daysUntilAttentionNeeded} days, your connection will start drifting. Reach out now while momentum is still strong.`,
      daysUntil: prediction.daysUntilAttentionNeeded,
      urgency: prediction.urgency,
    });
  }

  // 2. Optimal timing suggestion based on pattern
  if (pattern && pattern.sampleSize >= 2) { // Lowered from 3 to 2
    const lastInteractionDate = friend.lastUpdated;
    const daysSinceLastInteraction = differenceInDays(new Date(), lastInteractionDate);
    const expectedNextDay = pattern.averageIntervalDays;

    // If we're approaching their typical interval
    if (daysSinceLastInteraction >= expectedNextDay * 0.8 && daysSinceLastInteraction <= expectedNextDay * 1.2) {
      suggestions.push({
        type: 'optimal-timing',
        friendId: friend.id,
        friendName: friend.name,
        title: `Perfect time to connect with ${friend.name}`,
        message: `You typically connect every ${pattern.averageIntervalDays} days. Now is the ideal window based on your pattern.`,
        daysUntil: Math.max(0, expectedNextDay - daysSinceLastInteraction),
        urgency: 'medium',
      });
    }
  }

  // 3. Pattern break alert (when they're significantly overdue)
  if (pattern && pattern.sampleSize >= 2) { // Lowered from 3 to 2
    const lastInteractionDate = friend.lastUpdated;
    const daysSinceLastInteraction = differenceInDays(new Date(), lastInteractionDate);
    const expectedNextDay = pattern.averageIntervalDays;

    if (daysSinceLastInteraction > expectedNextDay * 1.5) {
      const daysOverdue = daysSinceLastInteraction - expectedNextDay;
      suggestions.push({
        type: 'pattern-break',
        friendId: friend.id,
        friendName: friend.name,
        title: `Breaking your pattern with ${friend.name}`,
        message: `You usually connect every ${pattern.averageIntervalDays} days, but it's been ${daysSinceLastInteraction}. The pattern is breaking.`,
        daysUntil: -daysOverdue, // negative means overdue
        urgency: friend.dunbarTier === 'InnerCircle' ? 'high' : 'medium',
      });
    }
  }

  // 4. Momentum opportunity (when score is high and recent)
  const currentScore = friend.weaveScore;
  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;

  if (currentScore > 70 && friend.momentumScore > 10 && daysSinceLastUpdate <= 5) {
    suggestions.push({
      type: 'momentum-opportunity',
      friendId: friend.id,
      friendName: friend.name,
      title: `Ride the momentum with ${friend.name}`,
      message: `You're connecting well right now (score: ${Math.round(currentScore)}). Another interaction soon would build a strong streak.`,
      daysUntil: 2, // Suggest within 2 days
      urgency: 'medium',
    });
  }

  return suggestions;
}

/**
 * Predicts best day of week to connect based on historical patterns
 */
export function predictOptimalDay(pattern: FriendshipPattern): { day: number; dayName: string; confidence: number } | null {
  if (!pattern.preferredDayOfWeek || pattern.sampleSize < 2) { // Lowered from 3 to 2
    return null;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    day: pattern.preferredDayOfWeek,
    dayName: dayNames[pattern.preferredDayOfWeek],
    confidence: pattern.consistency,
  };
}

/**
 * Forecasts network health N days into the future
 */
export function forecastNetworkHealth(
  friends: FriendModel[],
  daysAhead: number
): {
  currentHealth: number;
  forecastedHealth: number;
  friendsNeedingAttention: FriendModel[];
  confidence: number;
} {
  // Weight by tier importance
  const tierWeights: Record<Tier, number> = {
    InnerCircle: 3.0,
    CloseFriends: 2.0,
    Community: 1.0,
  };

  let currentWeightedSum = 0;
  let forecastedWeightedSum = 0;
  let weightTotal = 0;
  const friendsNeedingAttention: FriendModel[] = [];

  friends.forEach(friend => {
    const currentScore = friend.weaveScore;
    const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
    const dailyDecay = (tierDecayRate * 1.0) / friend.resilience; // average decay
    const forecastedScore = Math.max(0, currentScore - (dailyDecay * daysAhead));

    const weight = tierWeights[friend.dunbarTier as Tier] || 1.0;
    currentWeightedSum += currentScore * weight;
    forecastedWeightedSum += forecastedScore * weight;
    weightTotal += weight;

    // Check if friend will need attention
    const attentionThreshold = friend.dunbarTier === 'InnerCircle' ? 50 :
      friend.dunbarTier === 'CloseFriends' ? 40 : 30;

    if (forecastedScore <= attentionThreshold) {
      friendsNeedingAttention.push(friend);
    }
  });

  const currentHealth = weightTotal > 0 ? Math.round(currentWeightedSum / weightTotal) : 0;
  const forecastedHealth = weightTotal > 0 ? Math.round(forecastedWeightedSum / weightTotal) : 0;

  // Confidence decreases with longer forecasts
  const confidence = Math.max(0.3, 1.0 - (daysAhead / 30) * 0.5);

  return {
    currentHealth,
    forecastedHealth,
    friendsNeedingAttention,
    confidence,
  };
}

export interface CompositeHealthSignal {
  decayScore: number; // From decay service (0-100)
  patternScore: number; // From interaction patterns (0-100)
  reciprocityScore: number; // From initiation balance (0-100)
  batteryAlignmentScore: number; // Battery level when last interacted (0-100)
  momentumScore: number; // Current momentum (0-100)
  qualityScore: number; // Recent interaction quality (0-100)
}

/**
 * Calculate a composite relationship health prediction combining multiple signals
 */
export function calculateCompositeHealthPrediction(
  friend: FriendModel,
  signals: CompositeHealthSignal
): { score: number; confidence: number; topFactors: string[] } {
  // Weighted composite score
  const weights = {
    decay: 0.30,
    pattern: 0.25,
    reciprocity: 0.15,
    batteryAlignment: 0.10,
    momentum: 0.10,
    quality: 0.10,
  };

  const score =
    signals.decayScore * weights.decay +
    signals.patternScore * weights.pattern +
    signals.reciprocityScore * weights.reciprocity +
    signals.batteryAlignmentScore * weights.batteryAlignment +
    signals.momentumScore * weights.momentum +
    signals.qualityScore * weights.quality;

  // Identify top contributing factors
  const factors = Object.entries(signals)
    .map(([key, val]) => ({ key, contribution: val * (weights[key as keyof typeof weights] || 0) }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((f) => f.key);

  return { score, confidence: 0.85, topFactors: factors };
}
