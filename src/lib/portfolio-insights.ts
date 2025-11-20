/**
 * @deprecated Use @/modules/insights/services/portfolio.service.ts instead
 */
import { Suggestion } from '../types/suggestions';
import { Archetype, Tier } from '../types/core';

/**
 * Portfolio-level insights analyze your entire relationship network
 * to provide strategic, bird's-eye view suggestions
 */

interface FriendStats {
  id: string;
  name: string;
  tier: Tier;
  archetype: Archetype;
  score: number;
  daysSinceInteraction: number;
}

export interface PortfolioAnalysis {
  friends: FriendStats[];
  tierScores: {
    inner: { avg: number; count: number; drifting: number };
    close: { avg: number; count: number; drifting: number };
    community: { avg: number; count: number; drifting: number };
  };
  archetypeBalance: Record<Archetype, number>;
}

/**
 * Generates portfolio-level insights based on overall network health
 */
export function generatePortfolioInsights(analysis: PortfolioAnalysis): Suggestion | null {
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
      urgency: 'medium',
      category: 'portfolio',
      title: 'Close Friends need attention',
      subtitle: `Your Inner Circle is thriving (${Math.round(tierScores.inner.avg)}), but ${tierScores.close.drifting} Close Friends are cooling: ${driftingFriends.join(', ')}.`,
      actionLabel: 'Review Close Friends',
      icon: '📊',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // INSIGHT 2: Inner Circle Crisis
  // Multiple Inner Circle members drifting
  if (tierScores.inner.drifting >= 2 && tierScores.inner.avg < 60) {
    return {
      id: `portfolio-inner-crisis-${Date.now()}`,
      friendId: '',
      friendName: '',
      urgency: 'high',
      category: 'portfolio',
      title: 'Inner Circle needs care',
      subtitle: `${tierScores.inner.drifting} of your closest connections are drifting (avg ${Math.round(tierScores.inner.avg)}). Time to prioritize your core relationships.`,
      actionLabel: 'Focus on Inner Circle',
      icon: '⚠️',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // INSIGHT 2b: Inner Circle Mixed Signals
  // Some Inner Circle drifting even though overall avg is good
  if (tierScores.inner.drifting >= 1 && tierScores.inner.avg >= 60 && tierScores.inner.count >= 3) {
    const driftingFriends = friends
      .filter(f => f.tier === 'InnerCircle' && f.score < 50)
      .slice(0, 2)
      .map(f => f.name);

    return {
      id: `portfolio-inner-mixed-${Date.now()}`,
      friendId: '',
      friendName: '',
      urgency: 'medium',
      category: 'portfolio',
      title: 'Some Inner Circle members need attention',
      subtitle: `While most of your Inner Circle is strong, ${driftingFriends.join(' and ')} ${tierScores.inner.drifting === 1 ? 'is' : 'are'} cooling off.`,
      actionLabel: 'Check Inner Circle',
      icon: '💛',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // INSIGHT 3: Archetype Neglect
  // One archetype is being consistently ignored
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
        urgency: 'low',
        category: 'portfolio',
        title: `Your ${neglectedType}s feel distant`,
        subtitle: `Friends like ${neglectedFriends.map(f => f.name).join(' and ')} (avg ${Math.round(avgScore)}) may need different connection styles.`,
        actionLabel: 'Learn More',
        icon: '💡',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  // INSIGHT 4: Network Thriving
  // Everything is going well - celebrate!
  const overallAvg =
    (tierScores.inner.avg * tierScores.inner.count +
      tierScores.close.avg * tierScores.close.count +
      tierScores.community.avg * tierScores.community.count) /
    friends.length;

  if (overallAvg > 75 && tierScores.inner.avg > 80) {
    return {
      id: `portfolio-thriving-${Date.now()}`,
      friendId: '',
      friendName: '',
      urgency: 'low',
      category: 'portfolio',
      title: 'Your weave is thriving!',
      subtitle: `Network health: ${Math.round(overallAvg)}. Your relationships are strong and balanced. Keep up the momentum!`,
      actionLabel: 'See Details',
      icon: '🌟',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // INSIGHT 5: Interaction Diversity Check
  // Show this less frequently - maybe once a week
  const now = Date.now();
  const weekInMs = 7 * 24 * 60 * 60 * 1000;
  const shouldShowDiversityInsight = Math.random() < 0.1; // 10% chance

  if (shouldShowDiversityInsight && friends.length >= 5) {
    // Find friends you haven't connected with recently
    const staleConnections = friends.filter(f => f.daysSinceInteraction > 14);

    if (staleConnections.length >= 3) {
      return {
        id: `portfolio-diversity-${Date.now()}`,
        friendId: '',
        friendName: '',
        urgency: 'low',
        category: 'portfolio',
        title: 'Broaden your connection circle',
        subtitle: `You've been focusing on the same friends. ${staleConnections.length} connections haven't heard from you in 2+ weeks.`,
        actionLabel: 'Mix It Up',
        icon: '🔄',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  return null;
}

/**
 * Calculates average score for an archetype
 */
function getArchetypeAverage(friends: FriendStats[], archetype: Archetype): number {
  const archetypeFriends = friends.filter(f => f.archetype === archetype);
  if (archetypeFriends.length === 0) return 100; // No friends of this type = no problem

  return archetypeFriends.reduce((sum, f) => sum + f.score, 0) / archetypeFriends.length;
}

/**
 * Builds archetype balance map
 */
export function analyzeArchetypeBalance(friends: FriendStats[]): Record<Archetype, number> {
  const archetypes: Archetype[] = [
    'Sage',
    'Magician',
    'Explorer',
    'Loyalist',
    'Champion',
    'Caregiver',
    'Jester',
    'Rebel',
  ];

  return archetypes.reduce((acc, archetype) => {
    acc[archetype] = getArchetypeAverage(friends, archetype);
    return acc;
  }, {} as Record<Archetype, number>);
}
