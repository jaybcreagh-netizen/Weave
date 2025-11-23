import { Tier, Archetype } from '@/shared/types/core';
import { InteractionCategory } from '@/shared/types/interactions';

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
    category: InteractionCategory;
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

export interface ProactiveSuggestion {
  type: 'upcoming-drift' | 'optimal-timing' | 'pattern-break' | 'momentum-opportunity';
  friendId: string;
  friendName: string;
  title: string;
  message: string;
  daysUntil: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

// Effectiveness Types
export interface EffectivenessInsights {
  mostEffective: Array<{ category: InteractionCategory; ratio: number }>;
  leastEffective: Array<{ category: InteractionCategory; ratio: number }>;
  confidenceLevel: 'low' | 'medium' | 'high';
  sampleSize: number;
  recommendations: string[];
}
