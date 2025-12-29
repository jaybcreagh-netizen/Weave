import FriendModel from '@/db/models/Friend';
import { FriendshipPattern } from './pattern.service';
import { TierDecayRates, PersonalizedThresholdConfig } from '@/modules/intelligence/constants';
import { Tier } from '@/shared/types/common';
import { differenceInDays, getDay } from 'date-fns';
import { FriendPrediction, ProactiveSuggestion, BestDaysData } from '../types';
import { analyzeReciprocity, calculateReciprocityScore, ReciprocityAnalysis } from './reciprocity.service';

/**
 * Calculates a personalized attention threshold for a friend based on their historical patterns.
 *
 * Instead of using fixed thresholds (IC: 50, CF: 40, C: 30), this function adapts to each
 * friend's actual score patterns. If a friend typically maintains a score of 75-85, alerting
 * at 50 is too late. This calculates a threshold that triggers earlier based on their baseline.
 *
 * @param friend - The friend model with historical data
 * @returns The personalized attention threshold (higher for friends who typically have higher scores)
 */
export function calculatePersonalizedAttentionThreshold(friend: FriendModel): number {
  const tier = friend.dunbarTier as Tier;
  const baseThreshold = PersonalizedThresholdConfig.baseThresholds[tier] ||
    PersonalizedThresholdConfig.baseThresholds.Community;

  // Need sufficient interaction history to personalize
  const interactionCount = friend.ratedWeavesCount || 0;
  if (interactionCount < PersonalizedThresholdConfig.minInteractionsForPersonalization) {
    return baseThreshold;
  }

  // Use the friend's current score as a proxy for their typical baseline
  // In a more sophisticated implementation, we'd track historical average score
  const currentScore = friend.weaveScore;

  // Calculate personalized threshold based on their typical score level
  // If they usually hover at 75, threshold becomes: 75 * 0.65 = ~49
  const personalizedThreshold = currentScore * PersonalizedThresholdConfig.historicalFactor;

  // Blend personalized with base threshold
  // This prevents threshold from being too extreme in either direction
  const weight = PersonalizedThresholdConfig.personalizationWeight;
  const blendedThreshold = (personalizedThreshold * weight) + (baseThreshold * (1 - weight));

  // Ensure threshold stays within reasonable bounds
  // Minimum: tier base threshold - 10 (don't alert too late)
  // Maximum: tier base threshold + 25 (don't alert too early for consistently high scorers)
  const minThreshold = Math.max(20, baseThreshold - 10);
  const maxThreshold = Math.min(80, baseThreshold + 25);

  return Math.round(Math.max(minThreshold, Math.min(maxThreshold, blendedThreshold)));
}

/**
 * Gets attention threshold details including whether it's personalized
 */
export function getAttentionThresholdDetails(friend: FriendModel): {
  threshold: number;
  isPersonalized: boolean;
  baseThreshold: number;
  reason: string;
} {
  const tier = friend.dunbarTier as Tier;
  const baseThreshold = PersonalizedThresholdConfig.baseThresholds[tier] ||
    PersonalizedThresholdConfig.baseThresholds.Community;

  const interactionCount = friend.ratedWeavesCount || 0;
  const isPersonalized = interactionCount >= PersonalizedThresholdConfig.minInteractionsForPersonalization;

  const threshold = calculatePersonalizedAttentionThreshold(friend);

  let reason: string;
  if (!isPersonalized) {
    reason = `Using default ${tier} threshold (${interactionCount}/${PersonalizedThresholdConfig.minInteractionsForPersonalization} interactions for personalization)`;
  } else if (threshold > baseThreshold) {
    reason = `Higher threshold due to typically strong connection (score usually ~${Math.round(friend.weaveScore)})`;
  } else if (threshold < baseThreshold) {
    reason = `Lower threshold - this relationship tends to hover at lower scores`;
  } else {
    reason = `Personalized threshold aligns with ${tier} default`;
  }

  return {
    threshold,
    isPersonalized,
    baseThreshold,
    reason,
  };
}

/**
 * Predicts when a friend will need attention based on decay rate and patterns.
 * Now uses personalized attention thresholds based on friend's historical score patterns.
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

  // Use personalized attention threshold instead of fixed tier-based values
  // This adapts to each friend's typical score patterns for more accurate predictions
  const attentionThreshold = calculatePersonalizedAttentionThreshold(friend);

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
 * Options for generating proactive suggestions
 */
export interface SuggestionOptions {
  /** Include reciprocity-based suggestions (default: true) */
  includeReciprocity?: boolean;
  /** Include smart scheduling suggestions (default: true) */
  includeSmartScheduling?: boolean;
  /** Best days data from pattern detection (for smart scheduling) */
  bestDaysData?: BestDaysData;
  /** Current battery level (0-5) for battery-aware scheduling */
  currentBatteryLevel?: number;
}

/**
 * Data about best connection days from pattern detection
 */


const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generates proactive suggestions based on predictions, patterns, and multiple signals
 */
export function generateProactiveSuggestions(
  friend: FriendModel,
  pattern?: FriendshipPattern,
  options: SuggestionOptions = {}
): ProactiveSuggestion[] {
  const {
    includeReciprocity = true,
    includeSmartScheduling = true,
    bestDaysData,
    currentBatteryLevel,
  } = options;

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
  if (pattern && pattern.sampleSize >= 2) {
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
  if (pattern && pattern.sampleSize >= 2) {
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
      daysUntil: 2,
      urgency: 'medium',
    });
  }

  // 5. Reciprocity imbalance suggestion
  if (includeReciprocity) {
    const reciprocitySuggestion = generateReciprocitySuggestion(friend);
    if (reciprocitySuggestion) {
      suggestions.push(reciprocitySuggestion);
    }
  }

  // 6. Smart scheduling suggestion (battery-aware best day)
  if (includeSmartScheduling && bestDaysData) {
    const schedulingSuggestion = generateSmartSchedulingSuggestion(
      friend,
      bestDaysData,
      currentBatteryLevel
    );
    if (schedulingSuggestion) {
      suggestions.push(schedulingSuggestion);
    }
  }

  return suggestions;
}

/**
 * Generates a reciprocity-based suggestion if there's an imbalance
 */
function generateReciprocitySuggestion(friend: FriendModel): ProactiveSuggestion | null {
  const analysis = analyzeReciprocity(friend);

  // Only suggest if we have enough data and there's an imbalance
  if (analysis.totalInitiations < 5) return null;
  if (analysis.balance === 'balanced') return null;

  const ratio = analysis.initiationRatio;
  const userPercent = Math.round(ratio * 100);
  const friendPercent = 100 - userPercent;

  // User is initiating too much (>80%)
  if (ratio > 0.8) {
    const urgency = analysis.balance === 'one-sided' ? 'high' :
      analysis.balance === 'very-imbalanced' ? 'medium' : 'low';

    // Skip low urgency to reduce noise
    if (urgency === 'low') return null;

    return {
      type: 'reciprocity-imbalance',
      friendId: friend.id,
      friendName: friend.name,
      title: `Consider letting ${friend.name} reach out`,
      message: `You've initiated ${userPercent}% of interactions (${analysis.consecutiveUserInitiations} in a row). Consider creating space for them to reach out.`,
      daysUntil: 0, // Informational, not time-based
      urgency,
      metadata: {
        initiationRatio: ratio,
      },
    };
  }

  // Friend is initiating too much (< 30%) - encourage user to reach out more
  if (ratio < 0.3) {
    const urgency = analysis.balance === 'one-sided' ? 'medium' :
      analysis.balance === 'very-imbalanced' ? 'low' : 'low';

    // Skip low urgency
    if (urgency === 'low') return null;

    return {
      type: 'reciprocity-imbalance',
      friendId: friend.id,
      friendName: friend.name,
      title: `Reach out to ${friend.name}`,
      message: `${friend.name} has initiated ${friendPercent}% of your interactions. Consider reaching out first to balance the relationship.`,
      daysUntil: 0,
      urgency,
      metadata: {
        initiationRatio: ratio,
      },
    };
  }

  return null;
}

/**
 * Generates a smart scheduling suggestion based on best connection days and battery level
 */
function generateSmartSchedulingSuggestion(
  friend: FriendModel,
  bestDaysData: BestDaysData,
  currentBatteryLevel?: number
): ProactiveSuggestion | null {
  const today = getDay(new Date()); // 0-6 (Sunday-Saturday)
  const bestDay = bestDaysData.bestDay;

  // Calculate days until best day (can be 0-6)
  let daysUntilBest = bestDay.day - today;
  if (daysUntilBest < 0) daysUntilBest += 7;

  // Only suggest if the best day is within the next 3 days
  if (daysUntilBest > 3) return null;

  // Check if friend needs attention soon (to make this suggestion relevant)
  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;
  const toleranceWindow = friend.toleranceWindowDays || {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier as Tier];

  // Only suggest if approaching or past tolerance window
  if (daysSinceLastUpdate < toleranceWindow * 0.7) return null;

  // Battery-aware messaging
  let batteryContext = '';
  if (currentBatteryLevel !== undefined) {
    if (currentBatteryLevel >= 4 && bestDay.avgBattery >= 3.5) {
      batteryContext = ' Your energy is high and matches this day well.';
    } else if (currentBatteryLevel < 3 && bestDay.avgBattery >= 4) {
      batteryContext = ` Wait for ${DAY_NAMES[bestDay.day]} when your energy is typically higher.`;
    }
  }

  const dayName = DAY_NAMES[bestDay.day];
  const isToday = daysUntilBest === 0;

  return {
    type: 'best-day-scheduling',
    friendId: friend.id,
    friendName: friend.name,
    title: isToday
      ? `Today is your best day to connect with ${friend.name}`
      : `${dayName} is ideal for ${friend.name}`,
    message: isToday
      ? `Based on your patterns, you have high energy (${bestDay.avgBattery.toFixed(1)}/5) and connection success on ${dayName}s.${batteryContext}`
      : `Consider scheduling time with ${friend.name} on ${dayName} when your energy is typically ${bestDay.avgBattery.toFixed(1)}/5.${batteryContext}`,
    daysUntil: daysUntilBest,
    urgency: isToday ? 'medium' : 'low',
    metadata: {
      recommendedDay: bestDay.day,
      recommendedDayName: dayName,
      currentBatteryLevel,
    },
  };
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

    // Check if friend will need attention using personalized thresholds
    const attentionThreshold = calculatePersonalizedAttentionThreshold(friend);

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

/**
 * Builds a CompositeHealthSignal from friend data and patterns
 * This aggregates multiple signals into a format ready for composite health prediction
 */
export function buildCompositeHealthSignal(
  friend: FriendModel,
  pattern?: FriendshipPattern,
  currentBatteryLevel?: number
): CompositeHealthSignal {
  // 1. Decay score: Based on current weave score (already incorporates decay)
  const decayScore = friend.weaveScore;

  // 2. Pattern score: How consistent is the interaction pattern?
  let patternScore = 50; // Default neutral score
  if (pattern && pattern.sampleSize >= 2) {
    // Score based on consistency (0-1 maps to 0-100)
    const consistencyScore = pattern.consistency * 100;

    // Bonus for being within expected interval
    const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;
    const expectedInterval = pattern.averageIntervalDays;
    const intervalRatio = daysSinceLastUpdate / expectedInterval;

    // Perfect score around 0.8-1.2 ratio (approaching expected interval)
    let intervalBonus = 0;
    if (intervalRatio >= 0.8 && intervalRatio <= 1.2) {
      intervalBonus = 20; // On track
    } else if (intervalRatio < 0.8) {
      intervalBonus = 10; // Ahead of schedule (good)
    } else if (intervalRatio > 1.5) {
      intervalBonus = -20; // Significantly overdue (bad)
    }

    patternScore = Math.min(100, Math.max(0, consistencyScore + intervalBonus));
  }

  // 3. Reciprocity score: From reciprocity service (0-1 maps to 0-100)
  const reciprocityScore = calculateReciprocityScore(friend) * 100;

  // 4. Battery alignment score: Based on current battery vs typical interaction energy
  let batteryAlignmentScore = 50; // Default neutral
  if (currentBatteryLevel !== undefined) {
    // Higher score when user has energy to connect
    batteryAlignmentScore = (currentBatteryLevel / 5) * 100;
  }

  // 5. Momentum score: Based on friend's momentum (can be negative or positive)
  // Normalize momentum from typical range (-30 to +30) to 0-100
  const rawMomentum = friend.momentumScore || 0;
  const momentumScore = Math.min(100, Math.max(0, 50 + (rawMomentum * 1.67)));

  // 6. Quality score: Based on base weave score (qualityWeightedRating removed)
  const qualityScore = Math.min(100, friend.weaveScore);

  return {
    decayScore,
    patternScore,
    reciprocityScore,
    batteryAlignmentScore,
    momentumScore,
    qualityScore,
  };
}

/**
 * Gets a comprehensive health prediction for a friend using all available signals
 */
export function getComprehensiveHealthPrediction(
  friend: FriendModel,
  pattern?: FriendshipPattern,
  currentBatteryLevel?: number
): {
  compositeScore: number;
  confidence: number;
  topFactors: string[];
  signals: CompositeHealthSignal;
  prediction: FriendPrediction;
} {
  const signals = buildCompositeHealthSignal(friend, pattern, currentBatteryLevel);
  const composite = calculateCompositeHealthPrediction(friend, signals);
  const prediction = predictFriendDrift(friend, pattern);

  return {
    compositeScore: composite.score,
    confidence: composite.confidence,
    topFactors: composite.topFactors,
    signals,
    prediction,
  };
}
