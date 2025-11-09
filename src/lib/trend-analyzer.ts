import { database } from '../db';
import PortfolioSnapshot from '../db/models/PortfolioSnapshot';
import { Q } from '@nozbe/watermelondb';
import { type FriendshipPortfolio } from './portfolio-analyzer';
import { Tier } from '../components/types';

/**
 * Trend direction for a metric
 */
export type TrendDirection = 'improving' | 'stable' | 'declining';

/**
 * Trend analysis for a specific metric over time
 */
export interface MetricTrend {
  metric: string;
  currentValue: number;
  previousValue: number | null;
  changeAmount: number;
  changePercent: number;
  direction: TrendDirection;
  significance: 'major' | 'moderate' | 'minor' | 'none';
}

/**
 * Complete trend analysis comparing current state to historical data
 */
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

/**
 * Creates a snapshot of the current portfolio state for trend tracking
 */
export async function capturePortfolioSnapshot(portfolio: FriendshipPortfolio): Promise<void> {
  // Check if we already have a snapshot for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingSnapshotsToday = await database
    .get<PortfolioSnapshot>('portfolio_snapshots')
    .query(Q.where('snapshot_date', Q.gte(today.getTime())))
    .fetch();

  if (existingSnapshotsToday.length > 0) {
    // Already have a snapshot today, don't create duplicate
    return;
  }

  // Extract tier averages
  const innerCircleAvg = portfolio.tierDistribution.find(t => t.tier === 'InnerCircle')?.avgScore || 0;
  const closeFriendsAvg = portfolio.tierDistribution.find(t => t.tier === 'CloseFriends')?.avgScore || 0;
  const communityAvg = portfolio.tierDistribution.find(t => t.tier === 'Community')?.avgScore || 0;

  await database.write(async () => {
    await database.get<PortfolioSnapshot>('portfolio_snapshots').create(snapshot => {
      snapshot.snapshotDate = today;
      snapshot.overallHealthScore = portfolio.overallHealthScore;
      snapshot.totalFriends = portfolio.totalFriends;
      snapshot.activeFriends = portfolio.activeFriends;
      snapshot.driftingFriends = portfolio.driftingFriends;
      snapshot.thrivingFriends = portfolio.thrivingFriends;
      snapshot.innerCircleAvg = innerCircleAvg;
      snapshot.closeFriendsAvg = closeFriendsAvg;
      snapshot.communityAvg = communityAvg;
      snapshot.interactionsPerWeek = portfolio.recentActivityMetrics.interactionsPerWeek;
      snapshot.diversityScore = portfolio.recentActivityMetrics.diversityScore;
    });
  });
}

/**
 * Analyzes trends by comparing current portfolio to historical snapshots
 */
export async function analyzeTrends(
  currentPortfolio: FriendshipPortfolio,
  timeframe: 'week' | 'month' | '3months' = 'month'
): Promise<TrendAnalysis> {
  const daysBack = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
  const compareDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  compareDate.setHours(0, 0, 0, 0);

  // Get the closest snapshot from the comparison period
  const historicalSnapshots = await database
    .get<PortfolioSnapshot>('portfolio_snapshots')
    .query(
      Q.where('snapshot_date', Q.lte(compareDate.getTime())),
      Q.sortBy('snapshot_date', Q.desc),
      Q.take(1)
    )
    .fetch();

  const historicalSnapshot = historicalSnapshots[0];

  // If no historical data, return neutral trends
  if (!historicalSnapshot) {
    return createNeutralTrendAnalysis(currentPortfolio, timeframe);
  }

  // Calculate trends for each metric
  const overallHealthTrend = calculateMetricTrend(
    'Overall Network Health',
    currentPortfolio.overallHealthScore,
    historicalSnapshot.overallHealthScore
  );

  const tierTrends = [
    {
      tier: 'InnerCircle' as Tier,
      trend: calculateMetricTrend(
        'Inner Circle',
        currentPortfolio.tierDistribution.find(t => t.tier === 'InnerCircle')?.avgScore || 0,
        historicalSnapshot.innerCircleAvg
      ),
    },
    {
      tier: 'CloseFriends' as Tier,
      trend: calculateMetricTrend(
        'Close Friends',
        currentPortfolio.tierDistribution.find(t => t.tier === 'CloseFriends')?.avgScore || 0,
        historicalSnapshot.closeFriendsAvg
      ),
    },
    {
      tier: 'Community' as Tier,
      trend: calculateMetricTrend(
        'Community',
        currentPortfolio.tierDistribution.find(t => t.tier === 'Community')?.avgScore || 0,
        historicalSnapshot.communityAvg
      ),
    },
  ];

  const activeFriendsTrend = calculateMetricTrend(
    'Active Friends',
    currentPortfolio.activeFriends,
    historicalSnapshot.activeFriends
  );

  const driftingFriendsTrend = calculateMetricTrend(
    'Drifting Friends',
    currentPortfolio.driftingFriends,
    historicalSnapshot.driftingFriends,
    true // inverse: fewer drifting friends is better
  );

  const activityTrend = calculateMetricTrend(
    'Weekly Activity',
    currentPortfolio.recentActivityMetrics.interactionsPerWeek,
    historicalSnapshot.interactionsPerWeek
  );

  const diversityTrend = calculateMetricTrend(
    'Interaction Diversity',
    currentPortfolio.recentActivityMetrics.diversityScore * 100, // convert to 0-100 scale
    historicalSnapshot.diversityScore * 100
  );

  // Generate summary and alerts
  const { summary, alerts } = generateTrendSummary({
    timeframe,
    overallHealthTrend,
    tierTrends,
    activeFriendsTrend,
    driftingFriendsTrend,
    activityTrend,
  });

  return {
    timeframe,
    overallHealthTrend,
    tierTrends,
    activeFriendsTrend,
    driftingFriendsTrend,
    activityTrend,
    diversityTrend,
    summary,
    alerts,
  };
}

/**
 * Calculates trend metrics for a single value
 */
function calculateMetricTrend(
  metric: string,
  current: number,
  previous: number,
  inverseDirection: boolean = false
): MetricTrend {
  const changeAmount = current - previous;
  const changePercent = previous > 0 ? (changeAmount / previous) * 100 : 0;

  // Determine direction
  let direction: TrendDirection;
  const threshold = 0.05; // 5% change threshold for "stable"

  if (Math.abs(changePercent) < threshold * 100) {
    direction = 'stable';
  } else if (inverseDirection) {
    direction = changeAmount < 0 ? 'improving' : 'declining';
  } else {
    direction = changeAmount > 0 ? 'improving' : 'declining';
  }

  // Determine significance
  const absChangePercent = Math.abs(changePercent);
  let significance: MetricTrend['significance'];
  if (absChangePercent >= 20) {
    significance = 'major';
  } else if (absChangePercent >= 10) {
    significance = 'moderate';
  } else if (absChangePercent >= 5) {
    significance = 'minor';
  } else {
    significance = 'none';
  }

  return {
    metric,
    currentValue: Math.round(current * 10) / 10,
    previousValue: Math.round(previous * 10) / 10,
    changeAmount: Math.round(changeAmount * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    direction,
    significance,
  };
}

/**
 * Generates human-readable summary and alerts from trend data
 */
function generateTrendSummary(data: {
  timeframe: 'week' | 'month' | '3months';
  overallHealthTrend: MetricTrend;
  tierTrends: { tier: Tier; trend: MetricTrend }[];
  activeFriendsTrend: MetricTrend;
  driftingFriendsTrend: MetricTrend;
  activityTrend: MetricTrend;
}): { summary: string; alerts: string[] } {
  const { timeframe, overallHealthTrend, tierTrends, driftingFriendsTrend } = data;
  const timeframeText = timeframe === 'week' ? 'this week' : timeframe === 'month' ? 'this month' : 'the last 3 months';
  const alerts: string[] = [];

  // Overall summary
  let summary: string;
  if (overallHealthTrend.direction === 'improving' && overallHealthTrend.significance !== 'none') {
    summary = `Your network is ${overallHealthTrend.significance === 'major' ? 'significantly' : ''} improving ${timeframeText}! `;
    summary += `Overall health is up ${Math.abs(overallHealthTrend.changePercent).toFixed(1)}%.`;
  } else if (overallHealthTrend.direction === 'declining' && overallHealthTrend.significance !== 'none') {
    summary = `Your network needs attention. Overall health has declined ${Math.abs(overallHealthTrend.changePercent).toFixed(1)}% ${timeframeText}.`;
    alerts.push(`Network health declining: ${overallHealthTrend.previousValue} → ${overallHealthTrend.currentValue}`);
  } else {
    summary = `Your network is stable ${timeframeText}.`;
  }

  // Tier-specific alerts
  tierTrends.forEach(({ tier, trend }) => {
    if (trend.direction === 'declining' && trend.significance === 'major') {
      alerts.push(`${tier} health dropped significantly: ${trend.previousValue} → ${trend.currentValue}`);
    } else if (tier === 'InnerCircle' && trend.direction === 'declining' && trend.significance !== 'none') {
      alerts.push(`Inner Circle needs attention: down ${Math.abs(trend.changePercent).toFixed(1)}%`);
    }
  });

  // Drifting friends alert
  if (driftingFriendsTrend.direction === 'declining' && driftingFriendsTrend.changeAmount > 2) {
    alerts.push(`${Math.abs(driftingFriendsTrend.changeAmount)} more friends are drifting`);
  }

  return { summary, alerts };
}

/**
 * Creates a neutral trend analysis when no historical data exists
 */
function createNeutralTrendAnalysis(
  portfolio: FriendshipPortfolio,
  timeframe: 'week' | 'month' | '3months'
): TrendAnalysis {
  const createNeutral = (metric: string, value: number): MetricTrend => ({
    metric,
    currentValue: value,
    previousValue: null,
    changeAmount: 0,
    changePercent: 0,
    direction: 'stable',
    significance: 'none',
  });

  return {
    timeframe,
    overallHealthTrend: createNeutral('Overall Health', portfolio.overallHealthScore),
    tierTrends: portfolio.tierDistribution.map(t => ({
      tier: t.tier,
      trend: createNeutral(t.tier, t.avgScore),
    })),
    activeFriendsTrend: createNeutral('Active Friends', portfolio.activeFriends),
    driftingFriendsTrend: createNeutral('Drifting Friends', portfolio.driftingFriends),
    activityTrend: createNeutral('Activity', portfolio.recentActivityMetrics.interactionsPerWeek),
    diversityTrend: createNeutral('Diversity', portfolio.recentActivityMetrics.diversityScore * 100),
    summary: 'Building your trend history. Check back in a week!',
    alerts: [],
  };
}

/**
 * Gets historical snapshots for charting/visualization
 */
export async function getHistoricalSnapshots(
  days: number = 90
): Promise<PortfolioSnapshot[]> {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await database
    .get<PortfolioSnapshot>('portfolio_snapshots')
    .query(
      Q.where('snapshot_date', Q.gte(cutoffDate.getTime())),
      Q.sortBy('snapshot_date', Q.asc)
    )
    .fetch();
}
