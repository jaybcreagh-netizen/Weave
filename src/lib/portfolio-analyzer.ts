import { Tier, Archetype } from '../components/types';
import { InteractionCategory } from '../types/suggestions';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import FriendModel from '../db/models/Friend';
import { capturePortfolioSnapshot } from './trend-analyzer';

/**
 * Portfolio-level metrics for the user's entire friendship network
 */
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

/**
 * Detected imbalances in the friendship portfolio
 */
export interface PortfolioImbalance {
  type: 'tier-neglect' | 'overcommitment' | 'lack-diversity' | 'inner-circle-drift' | 'monotony';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedTier?: Tier;
  recommendedAction: string;
}

/**
 * Input data for portfolio analysis
 */
export interface PortfolioAnalysisInput {
  friends: FriendModel[];
  recentInteractions: Array<{
    interactionDate: Date;
    category?: InteractionCategory | string | null;
    friendIds: string[];
  }>;
}

/**
 * Analyzes the entire friendship portfolio to provide network-level insights
 */
export function analyzePortfolio(input: PortfolioAnalysisInput): FriendshipPortfolio {
  const { friends, recentInteractions } = input;

  // Calculate current scores for all friends
  const friendsWithScores = friends.map(friend => ({
    friend,
    currentScore: calculateCurrentScore(friend),
  }));

  // Overall health score (weighted by tier importance)
  const tierWeights: Record<Tier, number> = {
    InnerCircle: 3.0,
    CloseFriends: 2.0,
    Community: 1.0,
  };

  let weightedSum = 0;
  let weightTotal = 0;

  friendsWithScores.forEach(({ friend, currentScore }) => {
    const weight = tierWeights[friend.dunbarTier as Tier];
    weightedSum += currentScore * weight;
    weightTotal += weight;
  });

  const overallHealthScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  // Friend status counts
  const activeFriends = friendsWithScores.filter(f => f.currentScore > 30).length;
  const driftingFriends = friendsWithScores.filter(f => f.currentScore < 40).length;
  const thrivingFriends = friendsWithScores.filter(f => f.currentScore > 80).length;

  // Tier distribution
  const tierGroups = groupByTier(friendsWithScores);
  const tierDistribution = Object.entries(tierGroups).map(([tier, group]) => {
    const avgScore = group.reduce((sum, f) => sum + f.currentScore, 0) / group.length;
    const needsAttention = avgScore < 50 || (tier === 'InnerCircle' && avgScore < 60);

    return {
      tier: tier as Tier,
      count: group.length,
      percentage: Math.round((group.length / friends.length) * 100),
      avgScore: Math.round(avgScore),
      needsAttention,
    };
  });

  // Recent activity metrics (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentOnly = recentInteractions.filter(i => i.interactionDate >= thirtyDaysAgo);

  const totalInteractions = recentOnly.length;
  const interactionsPerWeek = Math.round((totalInteractions / 30) * 7 * 10) / 10;

  // Calculate how many unique friends were interacted with
  const uniqueFriendIds = new Set<string>();
  recentOnly.forEach(i => i.friendIds.forEach(id => uniqueFriendIds.add(id)));
  const avgInteractionsPerFriend = uniqueFriendIds.size > 0
    ? Math.round((totalInteractions / uniqueFriendIds.size) * 10) / 10
    : 0;

  // Diversity score (variety of interaction categories)
  const categorySet = new Set(
    recentOnly
      .map(i => i.category)
      .filter((c): c is InteractionCategory => !!c)
  );
  const diversityScore = Math.min(1, categorySet.size / 6); // 6+ categories = max diversity

  const recentActivityMetrics = {
    totalInteractions,
    interactionsPerWeek,
    avgInteractionsPerFriend,
    diversityScore,
  };

  // Category distribution
  const categoryCounts = new Map<InteractionCategory, number>();
  recentOnly.forEach(i => {
    if (i.category) {
      const cat = i.category as InteractionCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
  });

  const categoryDistribution = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalInteractions) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Archetype distribution
  const archetypeCounts = new Map<Archetype, number>();
  friends.forEach(f => {
    const archetype = f.archetype as Archetype;
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) || 0) + 1);
  });

  const archetypeDistribution = Array.from(archetypeCounts.entries())
    .map(([archetype, count]) => ({
      archetype,
      count,
      percentage: Math.round((count / friends.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Detect imbalances
  const imbalances = detectImbalances({
    friends,
    friendsWithScores,
    tierDistribution,
    recentActivityMetrics,
    categoryDistribution,
  });

  const portfolio = {
    overallHealthScore,
    totalFriends: friends.length,
    activeFriends,
    driftingFriends,
    thrivingFriends,
    tierDistribution,
    recentActivityMetrics,
    categoryDistribution,
    archetypeDistribution,
    imbalances,
    lastAnalyzed: new Date(),
  };

  // Automatically capture snapshot for trend tracking (fire and forget)
  capturePortfolioSnapshot(portfolio).catch(err =>
    console.warn('Failed to capture portfolio snapshot:', err)
  );

  return portfolio;
}

/**
 * Groups friends by Dunbar tier with their current scores
 */
function groupByTier(
  friendsWithScores: Array<{ friend: FriendModel; currentScore: number }>
): Record<Tier, Array<{ friend: FriendModel; currentScore: number }>> {
  const groups: Record<Tier, Array<{ friend: FriendModel; currentScore: number }>> = {
    InnerCircle: [],
    CloseFriends: [],
    Community: [],
  };

  friendsWithScores.forEach(item => {
    const tier = item.friend.dunbarTier as Tier;
    groups[tier].push(item);
  });

  return groups;
}

/**
 * Detects portfolio-level imbalances and issues
 */
function detectImbalances(context: {
  friends: FriendModel[];
  friendsWithScores: Array<{ friend: FriendModel; currentScore: number }>;
  tierDistribution: FriendshipPortfolio['tierDistribution'];
  recentActivityMetrics: FriendshipPortfolio['recentActivityMetrics'];
  categoryDistribution: FriendshipPortfolio['categoryDistribution'];
}): PortfolioImbalance[] {
  const imbalances: PortfolioImbalance[] = [];

  // Check for Inner Circle drift (CRITICAL)
  const innerCircle = context.tierDistribution.find(t => t.tier === 'InnerCircle');
  if (innerCircle && innerCircle.avgScore < 50) {
    imbalances.push({
      type: 'inner-circle-drift',
      severity: 'critical',
      title: 'Your closest friends need attention',
      description: `Your Inner Circle is drifting (avg score: ${innerCircle.avgScore}). These are your most important relationships.`,
      affectedTier: 'InnerCircle',
      recommendedAction: 'Prioritize quality time with your Inner Circle this week',
    });
  } else if (innerCircle && innerCircle.avgScore < 65) {
    imbalances.push({
      type: 'inner-circle-drift',
      severity: 'high',
      title: 'Inner Circle could use more attention',
      description: `Your closest friends are maintaining (avg score: ${innerCircle.avgScore}), but could be stronger.`,
      affectedTier: 'InnerCircle',
      recommendedAction: 'Schedule meaningful time with your Inner Circle',
    });
  }

  // Check for tier neglect
  context.tierDistribution.forEach(tier => {
    if (tier.needsAttention && tier.tier !== 'InnerCircle') {
      imbalances.push({
        type: 'tier-neglect',
        severity: tier.avgScore < 40 ? 'high' : 'medium',
        title: `${tier.tier} needs attention`,
        description: `Your ${tier.tier} tier is drifting (avg score: ${tier.avgScore}).`,
        affectedTier: tier.tier,
        recommendedAction: `Plan lighter-touch connections with your ${tier.tier} friends`,
      });
    }
  });

  // Check for overcommitment (too many interactions per week)
  if (context.recentActivityMetrics.interactionsPerWeek > 12) {
    imbalances.push({
      type: 'overcommitment',
      severity: 'medium',
      title: 'You might be overcommitted',
      description: `You're averaging ${context.recentActivityMetrics.interactionsPerWeek} interactions per week. This is a lot!`,
      recommendedAction: 'Consider focusing on quality over quantity. Your Inner Circle might need deeper time.',
    });
  }

  // Check for lack of diversity (doing same things)
  if (context.recentActivityMetrics.diversityScore < 0.3) {
    const topCategory = context.categoryDistribution[0];
    if (topCategory && topCategory.percentage > 60) {
      imbalances.push({
        type: 'monotony',
        severity: 'low',
        title: 'Your interactions are getting repetitive',
        description: `${topCategory.percentage}% of your recent interactions have been the same type.`,
        recommendedAction: 'Try mixing in different types of connection - variety deepens bonds',
      });
    }
  }

  // Check for lack of overall activity
  if (context.recentActivityMetrics.interactionsPerWeek < 2 && context.friends.length >= 5) {
    imbalances.push({
      type: 'tier-neglect',
      severity: 'medium',
      title: 'Your network needs more connection',
      description: `You're only averaging ${context.recentActivityMetrics.interactionsPerWeek} interactions per week.`,
      recommendedAction: 'Even small gestures count. Send a text or make a quick call.',
    });
  }

  // Sort by severity
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return imbalances.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
}

/**
 * Gets a human-readable summary of portfolio health
 */
export function getPortfolioHealthSummary(portfolio: FriendshipPortfolio): string {
  if (portfolio.overallHealthScore >= 80) {
    return `Your friendship network is thriving! ${portfolio.thrivingFriends} friends are doing great.`;
  } else if (portfolio.overallHealthScore >= 60) {
    return `Your network is healthy overall. ${portfolio.activeFriends} of ${portfolio.totalFriends} friends are active.`;
  } else if (portfolio.overallHealthScore >= 40) {
    return `Your network needs some attention. ${portfolio.driftingFriends} friends are drifting.`;
  } else {
    return `Your network needs urgent attention. Focus on your Inner Circle first.`;
  }
}

/**
 * Recommends which tier to focus on this week
 */
export function getWeeklyFocusRecommendation(portfolio: FriendshipPortfolio): {
  tier: Tier;
  reason: string;
  suggestedActions: string[];
} {
  // Always prioritize Inner Circle if drifting
  const innerCircle = portfolio.tierDistribution.find(t => t.tier === 'InnerCircle');
  if (innerCircle && innerCircle.avgScore < 60) {
    return {
      tier: 'InnerCircle',
      reason: `Your closest friends need attention (avg score: ${innerCircle.avgScore})`,
      suggestedActions: [
        'Schedule quality one-on-one time',
        'Have a meaningful conversation',
        'Plan something you both love',
      ],
    };
  }

  // Otherwise focus on the tier with lowest average score
  const lowestTier = [...portfolio.tierDistribution].sort((a, b) => a.avgScore - b.avgScore)[0];

  return {
    tier: lowestTier.tier,
    reason: `${lowestTier.tier} has the lowest average score (${lowestTier.avgScore})`,
    suggestedActions:
      lowestTier.tier === 'InnerCircle'
        ? ['Plan deep, quality time together', 'Have vulnerable conversations']
        : lowestTier.tier === 'CloseFriends'
        ? ['Grab coffee or a meal', 'Send a thoughtful message', 'Plan a group hangout']
        : ['Send quick check-in texts', 'React to their social media', 'Plan a casual group event'],
  };
}
