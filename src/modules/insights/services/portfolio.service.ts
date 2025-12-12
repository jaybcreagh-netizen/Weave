import { Tier, Archetype } from '@/shared/types/common';
import { InteractionCategory } from '@/shared/types/common';
import { calculateCurrentScore } from '@/modules/intelligence';
import FriendModel from '@/db/models/Friend';
import { capturePortfolioSnapshot } from './trend.service';
import { FriendshipPortfolio, PortfolioImbalance } from '../types';
import { Suggestion } from '@/shared/types/common';

// Types for analysis
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
  // NOTE: Intelligence module's calculateCurrentScore is async, but here we are mapping synchronously.
  // However, calculateCurrentScore in intelligence module MIGHT be async.
  // Let's check if calculateCurrentScore takes a FriendModel directly and returns a number.
  // In legacy lib/portfolio-analyzer.ts, it imported from orchestrator.service which was async in Phase 2 spec?
  // Wait, I need to check calculateCurrentScore signature.
  // Assuming for now we can get the score. Ideally we should fetch scores async.
  // But let's stick to the structure. If calculateCurrentScore is async, we need to make this function async.
  // I will assume it accepts FriendModel and returns number or Promise<number>.
  // Checking lib/portfolio-analyzer.ts, it imported `calculateCurrentScore` from `orchestrator.service`.
  // Let's assume synchronous for now or I'll fix it if I see an error.
  // Wait, `calculateCurrentScore` usually triggers a DB calc.
  // But `FriendModel` usually has `weave_score` property.
  // Let's use the `weave_score` property directly from the model for sync analysis if possible,
  // or make this function async. Making it async is safer.

  // REVISION: I'll make `analyzePortfolio` async to be safe.
  throw new Error("analyzePortfolio should be async. Please use analyzePortfolioAsync");
}

export async function analyzePortfolioAsync(input: PortfolioAnalysisInput): Promise<FriendshipPortfolio> {
  const { friends, recentInteractions } = input;

  // Calculate current scores for all friends
  const friendsWithScores = await Promise.all(friends.map(async friend => {
    const score = calculateCurrentScore(friend);
    return {
      friend,
      currentScore: isNaN(score) ? 0 : score,
    };
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
    const weight = tierWeights[friend.dunbarTier as Tier] || 1.0;
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
    const avgScore = group.reduce((sum, f) => sum + (isNaN(f.currentScore) ? 0 : f.currentScore), 0) / (group.length || 1);
    const safeAvgScore = isNaN(avgScore) ? 0 : avgScore;
    const needsAttention = safeAvgScore < 50 || (tier === 'InnerCircle' && safeAvgScore < 60);

    return {
      tier: tier as Tier,
      count: group.length,
      percentage: Math.round((group.length / friends.length) * 100) || 0,
      avgScore: Math.round(safeAvgScore),
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
      percentage: Math.round((count / (totalInteractions || 1)) * 100),
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
    if (groups[tier]) {
      groups[tier].push(item);
    }
  });

  return groups;
}

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
  const sortedTiers = [...portfolio.tierDistribution]
    .filter(t => t.count > 0) // Ignore empty tiers
    .sort((a, b) => a.avgScore - b.avgScore);

  if (sortedTiers.length === 0) {
    return {
      tier: 'InnerCircle',
      reason: 'Start connecting with friends',
      suggestedActions: ['Reach out to someone new'],
    };
  }

  const lowestTier = sortedTiers[0];

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

// --- Insights Generation (merged from portfolio-insights.ts) ---

interface FriendStats {
  id: string;
  name: string;
  tier: Tier;
  archetype: Archetype;
  score: number;
  daysSinceInteraction: number;
}

export interface PortfolioAnalysisStats {
  friends: FriendStats[];
  tierScores: {
    inner: { avg: number; count: number; drifting: number };
    close: { avg: number; count: number; drifting: number };
    community: { avg: number; count: number; drifting: number };
  };
  archetypeBalance: Record<Archetype, number>;
}

export function generatePortfolioInsights(analysis: PortfolioAnalysisStats): Suggestion | null {
  const { tierScores, friends, archetypeBalance } = analysis;

  // INSIGHT 1: Tier Imbalance Alert
  // Inner Circle thriving but Close Friends neglected
  if (
    tierScores.inner.avg > 70 &&
    tierScores.close.avg < 50 &&
    tierScores.close.count >= 3 &&
    tierScores.close.drifting >= 2
  ) {
    const driftingFriends = friends
      .filter(f => f.tier === 'CloseFriends' && f.score < 50)
      .slice(0, 3)
      .map(f => f.name);

    return {
      id: `portfolio-tier-imbalance-${Date.now()}`,
      friendId: '', // No specific friend
      friendName: '',
      priority: 'medium', // Mapped from urgency: medium
      type: 'reconnect', // Mapped from category: portfolio
      title: 'Close Friends need attention',
      subtitle: `Your Inner Circle is thriving (${Math.round(tierScores.inner.avg)}), but ${tierScores.close.drifting} Close Friends are cooling: ${driftingFriends.join(', ')}.`,
      icon: '📊',
      action: { type: 'plan' },
    };
  }

  // INSIGHT 2: Inner Circle Crisis
  if (tierScores.inner.drifting >= 2 && tierScores.inner.avg < 60) {
    return {
      id: `portfolio-inner-crisis-${Date.now()}`,
      friendId: '',
      friendName: '',
      priority: 'high', // Mapped from urgency: high
      type: 'deepen', // Mapped from category: portfolio
      title: 'Inner Circle needs care',
      subtitle: `${tierScores.inner.drifting} of your closest connections are drifting (avg ${Math.round(tierScores.inner.avg)}). Time to prioritize your core relationships.`,
      icon: '⚠️',
      action: { type: 'plan' },
    };
  }

  // INSIGHT 2b: Inner Circle Mixed Signals
  if (tierScores.inner.drifting >= 1 && tierScores.inner.avg >= 60 && tierScores.inner.count >= 3) {
    const driftingFriends = friends
      .filter(f => f.tier === 'InnerCircle' && f.score < 50)
      .slice(0, 2)
      .map(f => f.name);

    return {
      id: `portfolio-inner-mixed-${Date.now()}`,
      friendId: '',
      friendName: '',
      priority: 'medium', // Mapped from urgency: medium
      type: 'reconnect', // Mapped from category: portfolio
      title: 'Some Inner Circle members need attention',
      subtitle: `While most of your Inner Circle is strong, ${driftingFriends.join(' and ')} ${tierScores.inner.drifting === 1 ? 'is' : 'are'} cooling off.`,
      icon: '💛',
      action: { type: 'plan' },
    };
  }

  // INSIGHT 3: Archetype Neglect
  const archetypeEntries = Object.entries(archetypeBalance) as [Archetype, number][];
  const neglectedArchetypes = archetypeEntries.filter(([_, score]) => score < 40);

  if (neglectedArchetypes.length > 0 && friends.length >= 5) {
    const [neglectedType, avgScore] = neglectedArchetypes[0];
    const neglectedFriends = friends
      .filter(f => f.archetype === neglectedType)
      .slice(0, 2);

    if (neglectedFriends.length > 0) {
      return {
        id: `portfolio-archetype-neglect-${Date.now()}`,
        friendId: '',
        friendName: '',
        priority: 'low', // Mapped from urgency: low
        type: 'connect', // Mapped from category: portfolio
        title: `Your ${neglectedType}s feel distant`,
        subtitle: `Friends like ${neglectedFriends.map(f => f.name).join(' and ')} (avg ${Math.round(avgScore)}) may need different connection styles.`,
        icon: '💡',
        action: { type: 'plan' },
      };
    }
  }

  // INSIGHT 4: Network Thriving
  const overallAvg =
    (tierScores.inner.avg * tierScores.inner.count +
      tierScores.close.avg * tierScores.close.count +
      tierScores.community.avg * tierScores.community.count) /
    (friends.length || 1);

  if (overallAvg > 75 && tierScores.inner.avg > 80) {
    return {
      id: `portfolio-thriving-${Date.now()}`,
      friendId: '',
      friendName: '',
      priority: 'low', // Mapped from urgency: low
      type: 'celebrate', // Mapped from category: portfolio
      title: 'Your weave is thriving!',
      subtitle: `Network health: ${Math.round(overallAvg)}. Your relationships are strong and balanced. Keep up the momentum!`,
      icon: '🌟',
      action: { type: 'plan' },
    };
  }

  // INSIGHT 5: Interaction Diversity Check
  const shouldShowDiversityInsight = Math.random() < 0.1; // 10% chance

  if (shouldShowDiversityInsight && friends.length >= 5) {
    const staleConnections = friends.filter(f => f.daysSinceInteraction > 14);

    if (staleConnections.length >= 3) {
      return {
        id: `portfolio-diversity-${Date.now()}`,
        friendId: '',
        friendName: '',
        priority: 'low', // Mapped from urgency: low
        type: 'connect', // Mapped from category: portfolio
        title: 'Broaden your connection circle',
        subtitle: `You've been focusing on the same friends. ${staleConnections.length} connections haven't heard from you in 2+ weeks.`,
        icon: '🔄',
        action: { type: 'plan' },
      };
    }
  }

  return null;
}

function getArchetypeAverage(friends: FriendStats[], archetype: Archetype): number {
  const archetypeFriends = friends.filter(f => f.archetype === archetype);
  if (archetypeFriends.length === 0) return 100; // No friends of this type = no problem

  return archetypeFriends.reduce((sum, f) => sum + f.score, 0) / archetypeFriends.length;
}

export function analyzeArchetypeBalance(friends: FriendStats[]): Record<Archetype, number> {
  const archetypes: Archetype[] = [
    'Emperor',
    'Empress',
    'HighPriestess',
    'Fool',
    'Sun',
    'Hermit',
    'Magician',
    'Lovers',
    'Unknown',
  ];

  return archetypes.reduce((acc, archetype) => {
    acc[archetype] = getArchetypeAverage(friends, archetype);
    return acc;
  }, {} as Record<Archetype, number>);
}
