import { Tier, Archetype } from '@/shared/types/core';
// import { InteractionCategory } from '@/shared/types/interactions';

// Trend Types
export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface MetricTrend {
  metric: string;
  currentValue: number;
  previousValue: number | null;
  changeAmount: number;
  changePercent: number;
  direction: TrendDirection;
  significance: 'major' | 'moderate' | 'minor' | 'none';
}

export interface TrendAnalysis {
  timeframe: 'week' | 'month' | '3months';
  overallHealthTrend: MetricTrend;
  tierTrends: {
    tier: Tier;
    trend: MetricTrend;
  }[];
  activeFriendsTrend: MetricTrend;
  driftingFriendsTrend: MetricTrend;
  activityTrend: MetricTrend; // interactions per week
  diversityTrend: MetricTrend;

  summary: string; // Human-readable summary
  alerts: string[]; // Notable changes to highlight
}

// Portfolio Types
export interface FriendshipPortfolio {
  // Network Health
  overallHealthScore: number; // 0-100, weighted average of all friends
  totalFriends: number;
  activeFriends: number; // score > 30
  driftingFriends: number; // score < 40
  thrivingFriends: number; // score > 80

  // Tier Distribution
  tierDistribution: {
    tier: Tier;
    count: number;
    percentage: number;
    avgScore: number;
    needsAttention: boolean;
  }[];

  // Interaction Patterns (last 30 days)
  recentActivityMetrics: {
    totalInteractions: number;
    interactionsPerWeek: number;
    avgInteractionsPerFriend: number;
    diversityScore: number; // 0-1, variety of interaction types
  };

  // Category Distribution (what types of interactions)
  categoryDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];

  // Archetype Balance
  archetypeDistribution: {
    archetype: Archetype;
    count: number;
    percentage: number;
  }[];

  // Recommendations
  imbalances: PortfolioImbalance[];

  lastAnalyzed: Date;
}

export interface PortfolioImbalance {
  type: 'tier-neglect' | 'overcommitment' | 'lack-diversity' | 'inner-circle-drift' | 'monotony';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedTier?: Tier;
  recommendedAction: string;
}

// Prediction Types
export interface FriendPrediction {
  friendId: string;
  friendName: string;
  currentScore: number;
  predictedScore: number; // What score will be in N days
  daysUntilAttentionNeeded: number; // Days until score drops below threshold
  confidence: number; // 0-1, how confident we are in this prediction
  reason: string; // Why this prediction was made
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export type SuggestionType =
  | 'upcoming-drift'
  | 'optimal-timing'
  | 'pattern-break'
  | 'momentum-opportunity'
  | 'reciprocity-imbalance'
  | 'best-day-scheduling';

export interface ProactiveSuggestion {
  type: SuggestionType;
  friendId: string;
  friendName: string;
  title: string;
  message: string;
  daysUntil: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  /** Optional metadata for specific suggestion types */
  metadata?: {
    /** For reciprocity-imbalance: the ratio of user initiations (0-1) */
    initiationRatio?: number;
    /** For best-day-scheduling: recommended day of week (0-6) */
    recommendedDay?: number;
    /** For best-day-scheduling: day name */
    recommendedDayName?: string;
    /** Battery level when this suggestion was generated */
    currentBatteryLevel?: number;
  };
}

// Effectiveness Types
export interface EffectivenessInsights {
  mostEffective: Array<{ category: string; ratio: number }>;
  leastEffective: Array<{ category: string; ratio: number }>;
  confidenceLevel: 'low' | 'medium' | 'high';
  sampleSize: number;
  recommendations: string[];
}

// Tier Intelligence Types (v36)
export type FlexibilityMode = 'strict' | 'balanced' | 'flexible';

export type TierFitCategory = 'great' | 'good' | 'mismatch' | 'insufficient_data';

export interface TierFitAnalysis {
  friendId: string;
  friendName: string;
  currentTier: Tier;

  // Pattern data
  actualIntervalDays: number;
  expectedIntervalDays: number;
  interactionCount: number; // Sample size

  // Fit scoring
  fitScore: number; // 0-1, where 1 = perfect fit
  fitCategory: TierFitCategory;

  // Recommendations
  suggestedTier?: Tier;
  confidence: number; // 0-1
  reason: string;
  isPreliminary?: boolean;
}

export interface TierHealth {
  total: number;
  great: number;
  good: number;
  mismatch: number;
}

export interface NetworkTierHealth {
  healthScore: number; // 0-10
  tierHealth: {
    InnerCircle: TierHealth;
    CloseFriends: TierHealth;
    Community: TierHealth;
  };
  mismatches: TierFitAnalysis[];
  suggestions: TierFitAnalysis[]; // Top suggestions with suggestedTier
  allAnalyses: TierFitAnalysis[]; // All analyses including insufficient_data
}
