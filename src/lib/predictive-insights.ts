import FriendModel from '../db/models/Friend';
import { calculateCurrentScore } from './weave-engine';
import { analyzeInteractionPattern, predictNextInteraction, type FriendshipPattern } from './pattern-analyzer';
import { TierDecayRates } from './constants';
import { Tier } from '../components/types';
import { differenceInDays } from 'date-fns';

/**
 * Prediction for when a friend will need attention
 */
export interface FriendPrediction {
  friend: FriendModel;
  currentScore: number;
  predictedScore: number; // What score will be in N days
  daysUntilAttentionNeeded: number; // Days until score drops below threshold
  confidence: number; // 0-1, how confident we are in this prediction
  reason: string; // Why this prediction was made
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Proactive suggestion based on prediction
 */
export interface ProactiveSuggestion {
  type: 'upcoming-drift' | 'optimal-timing' | 'pattern-break' | 'momentum-opportunity';
  friendId: string;
  friendName: string;
  title: string;
  message: string;
  daysUntil: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Predicts when a friend will need attention based on decay rate and patterns
 */
export function predictFriendDrift(
  friend: FriendModel,
  pattern?: FriendshipPattern
): FriendPrediction {
  const currentScore = calculateCurrentScore(friend);
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];

  // Determine attention threshold based on tier
  const attentionThreshold = friend.dunbarTier === 'InnerCircle' ? 50 :
                            friend.dunbarTier === 'CloseFriends' ? 40 : 30;

  // If already below threshold, immediate attention needed
  if (currentScore <= attentionThreshold) {
    return {
      friend,
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
  let confidence = 0.7; // base confidence
  if (pattern && pattern.sampleSize >= 5) {
    confidence = Math.min(0.95, 0.7 + (pattern.consistency * 0.25));
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
    friend,
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
  if (pattern && pattern.sampleSize >= 3) {
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
  if (pattern && pattern.sampleSize >= 3) {
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
  const currentScore = calculateCurrentScore(friend);
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
  if (!pattern.preferredDayOfWeek || pattern.sampleSize < 3) {
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
    const currentScore = calculateCurrentScore(friend);
    const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
    const dailyDecay = (tierDecayRate * 1.0) / friend.resilience; // average decay
    const forecastedScore = Math.max(0, currentScore - (dailyDecay * daysAhead));

    const weight = tierWeights[friend.dunbarTier as Tier];
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
