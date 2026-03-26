import type { Suggestion } from '@/shared/types/common';
import type { Opportunity } from '../../opportunity-system/types';
import {
  analyzeArchetypeBalance,
  type PortfolioAnalysisStats,
} from '@/modules/insights/services/portfolio.service';
import type { Archetype } from '@/shared/types/common';

interface PortfolioDescriptor {
  id: string;
  generatorSource: string;
  title: string;
  subtitle: string;
  icon: string;
  suggestionType: Suggestion['type'];
  urgency: NonNullable<Suggestion['urgency']>;
  urgencyScore: number;
  confidence: number;
  effortLevel: Opportunity['effortLevel'];
  estimatedDurationMinutes: number;
  bestWindow: Opportunity['timeRelevance']['bestWindow'];
  whyThisAction: string;
}

function createTierScores(friendStats: PortfolioAnalysisStats['friends']) {
  const innerFriends = friendStats.filter(friend => friend.tier === 'InnerCircle');
  const closeFriends = friendStats.filter(friend => friend.tier === 'CloseFriends');
  const communityFriends = friendStats.filter(friend => friend.tier === 'Community');

  const averageScore = (friends: PortfolioAnalysisStats['friends']) =>
    friends.reduce((sum, friend) => sum + friend.score, 0) / (friends.length || 1);

  return {
    inner: {
      avg: averageScore(innerFriends) || 0,
      count: innerFriends.length,
      drifting: innerFriends.filter(friend => friend.score < 50).length,
    },
    close: {
      avg: averageScore(closeFriends) || 0,
      count: closeFriends.length,
      drifting: closeFriends.filter(friend => friend.score < 40).length,
    },
    community: {
      avg: averageScore(communityFriends) || 0,
      count: communityFriends.length,
      drifting: communityFriends.filter(friend => friend.score < 30).length,
    },
  };
}

export function buildPortfolioAnalysis(
  friendStats: PortfolioAnalysisStats['friends']
): PortfolioAnalysisStats | null {
  const uniqueFriendStats = Array.from(new Map(friendStats.map(friend => [friend.id, friend])).values());
  if (uniqueFriendStats.length < 3) {
    return null;
  }

  return {
    friends: uniqueFriendStats,
    tierScores: createTierScores(uniqueFriendStats),
    archetypeBalance: analyzeArchetypeBalance(uniqueFriendStats),
  };
}

function buildDescriptor(analysis: PortfolioAnalysisStats): PortfolioDescriptor | null {
  const { tierScores, friends, archetypeBalance } = analysis;

  if (
    tierScores.inner.avg > 70
    && tierScores.close.avg < 50
    && tierScores.close.count >= 3
    && tierScores.close.drifting >= 2
  ) {
    const driftingFriends = friends
      .filter(friend => friend.tier === 'CloseFriends' && friend.score < 50)
      .slice(0, 3)
      .map(friend => friend.name);

    return {
      id: 'portfolio-tier-imbalance',
      generatorSource: 'portfolio-tier-imbalance',
      title: 'Close Friends need attention',
      subtitle: `Your Inner Circle is thriving (${Math.round(tierScores.inner.avg)}), but ${tierScores.close.drifting} Close Friends are cooling: ${driftingFriends.join(', ')}.`,
      icon: 'BarChart3',
      suggestionType: 'reconnect',
      urgency: 'medium',
      urgencyScore: 62,
      confidence: 0.84,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      bestWindow: 'morning',
      whyThisAction: 'A quick review of who needs lighter-touch attention will rebalance the shape of your network.',
    };
  }

  if (tierScores.inner.drifting >= 2 && tierScores.inner.avg < 60) {
    return {
      id: 'portfolio-inner-crisis',
      generatorSource: 'portfolio-inner-crisis',
      title: 'Inner Circle needs care',
      subtitle: `${tierScores.inner.drifting} of your closest connections are drifting (avg ${Math.round(tierScores.inner.avg)}). Time to prioritize your core relationships.`,
      icon: 'AlertTriangle',
      suggestionType: 'deepen',
      urgency: 'high',
      urgencyScore: 88,
      confidence: 0.9,
      effortLevel: 'high',
      estimatedDurationMinutes: 45,
      bestWindow: 'morning',
      whyThisAction: 'Protecting your core relationships is the highest-leverage move right now.',
    };
  }

  if (tierScores.inner.drifting >= 1 && tierScores.inner.avg >= 60 && tierScores.inner.count >= 3) {
    const driftingFriends = friends
      .filter(friend => friend.tier === 'InnerCircle' && friend.score < 50)
      .slice(0, 2)
      .map(friend => friend.name);

    return {
      id: 'portfolio-inner-mixed',
      generatorSource: 'portfolio-inner-mixed',
      title: 'Some Inner Circle members need attention',
      subtitle: `While most of your Inner Circle is strong, ${driftingFriends.join(' and ')} ${tierScores.inner.drifting === 1 ? 'is' : 'are'} cooling off.`,
      icon: 'Heart',
      suggestionType: 'reconnect',
      urgency: 'medium',
      urgencyScore: 67,
      confidence: 0.82,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      bestWindow: 'morning',
      whyThisAction: 'A small amount of targeted attention now can stop your closest relationships from splitting into winners and drifters.',
    };
  }

  const archetypeEntries = Object.entries(archetypeBalance) as [Archetype, number][];
  const neglectedArchetypes = archetypeEntries.filter(([, score]) => score < 40);

  if (neglectedArchetypes.length > 0 && friends.length >= 5) {
    const [neglectedType, avgScore] = neglectedArchetypes[0];
    const neglectedFriends = friends
      .filter(friend => friend.archetype === neglectedType)
      .slice(0, 2);

    if (neglectedFriends.length > 0) {
      return {
        id: `portfolio-archetype-neglect-${neglectedType}`,
        generatorSource: `portfolio-archetype-neglect-${neglectedType}`,
        title: `Your ${neglectedType}s feel distant`,
        subtitle: `Friends like ${neglectedFriends.map(friend => friend.name).join(' and ')} (avg ${Math.round(avgScore)}) may need different connection styles.`,
        icon: 'Lightbulb',
        suggestionType: 'connect',
        urgency: 'low',
        urgencyScore: 38,
        confidence: 0.72,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 20,
        bestWindow: 'afternoon',
        whyThisAction: 'Looking at the pattern by archetype can show you which style of connection has been neglected.',
      };
    }
  }

  const overallAvg =
    (tierScores.inner.avg * tierScores.inner.count
      + tierScores.close.avg * tierScores.close.count
      + tierScores.community.avg * tierScores.community.count)
    / (friends.length || 1);

  if (overallAvg > 75 && tierScores.inner.avg > 80) {
    return {
      id: 'portfolio-thriving',
      generatorSource: 'portfolio-thriving',
      title: 'Your weave is thriving!',
      subtitle: `Network health: ${Math.round(overallAvg)}. Your relationships are strong and balanced. Keep up the momentum!`,
      icon: 'Sparkles',
      suggestionType: 'celebrate',
      urgency: 'low',
      urgencyScore: 34,
      confidence: 0.8,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      bestWindow: 'evening',
      whyThisAction: 'A quick review helps you notice what is working so you can keep it going.',
    };
  }

  const staleConnections = friends.filter(friend => friend.daysSinceInteraction > 14);
  if (friends.length >= 5 && staleConnections.length >= 3) {
    return {
      id: 'portfolio-diversity',
      generatorSource: 'portfolio-diversity',
      title: 'Broaden your connection circle',
      subtitle: `You've been focusing on the same friends. ${staleConnections.length} connections haven't heard from you in 2+ weeks.`,
      icon: 'RefreshCcw',
      suggestionType: 'connect',
      urgency: 'low',
      urgencyScore: 36,
      confidence: 0.7,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 20,
      bestWindow: 'morning',
      whyThisAction: 'A small portfolio review can stop your network from narrowing without you noticing.',
    };
  }

  return null;
}

export function buildPortfolioSuggestion(
  analysis: PortfolioAnalysisStats,
  now: Date = new Date()
): Suggestion | null {
  const descriptor = buildDescriptor(analysis);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    friendId: '',
    friendName: '',
    urgency: descriptor.urgency,
    priority: descriptor.urgency === 'high' ? 'high' : descriptor.urgency === 'medium' ? 'medium' : 'low',
    category: 'portfolio',
    type: descriptor.suggestionType,
    title: descriptor.title,
    subtitle: descriptor.subtitle,
    icon: descriptor.icon,
    action: { type: 'plan' },
    actionLabel: 'Review',
    dismissible: true,
    createdAt: now,
  };
}

export function buildPortfolioOpportunity(
  analysis: PortfolioAnalysisStats,
  now: Date = new Date()
): Opportunity | null {
  const descriptor = buildDescriptor(analysis);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    category: 'portfolio',
    generatorSource: descriptor.generatorSource,
    urgency: descriptor.urgencyScore,
    confidence: descriptor.confidence,
    effortLevel: descriptor.effortLevel,
    estimatedDurationMinutes: descriptor.estimatedDurationMinutes,
    explanation: {
      whyNow: descriptor.subtitle,
      whyThisFriend: 'This is a network-level relationship opportunity rather than a single-friend prompt.',
      whyThisAction: descriptor.whyThisAction,
    },
    timeRelevance: {
      bestWindow: descriptor.bestWindow,
    },
    createdAt: now.getTime(),
  };
}
