import { Suggestion, SuggestionInput } from '../types/suggestions';
import {
  getArchetypePreferredCategory,
  getArchetypeDriftSuggestion,
  getArchetypeMomentumSuggestion,
} from './archetype-content';

// Friendly category labels for suggestions
const CATEGORY_LABELS: Record<string, string> = {
  'text-call': 'chat',
  'meal-drink': 'meal',
  'hangout': 'hangout',
  'deep-talk': 'deep conversation',
  'activity-hobby': 'activity',
  'event-party': 'event',
  'favor-support': 'time together',
  'celebration': 'celebration',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || 'time together';
}

const COOLDOWN_DAYS = {
  'critical-drift': 1,
  'high-drift': 2,
  'first-weave': 2,
  'archetype-mismatch': 3,
  'momentum': 7,
  'maintenance': 3,
  'deepen': 7,
  'reflect': 2,
};

export function generateSuggestion(input: SuggestionInput): Suggestion | null {
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions } = input;

  // PRIORITY 1: Reflect on recent interaction
  const recentReflectSuggestion = checkReflectSuggestion(friend, recentInteractions);
  if (recentReflectSuggestion) return recentReflectSuggestion;

  // PRIORITY 2: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    return {
      id: `critical-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'drift',
      title: `${friend.name} is drifting away`,
      subtitle: getArchetypeDriftSuggestion(friend.archetype),
      actionLabel: 'Reach Out Now',
      icon: '🚨',
      action: {
        type: 'log',
        prefilledCategory: getArchetypePreferredCategory(friend.archetype),
        prefilledMode: 'detailed',
      },
      dismissible: false, // Too important to dismiss
      createdAt: new Date(),
    };
  }

  // PRIORITY 3: High drift (attention needed)
  const isHighDrift =
    (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
    (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

  if (isHighDrift) {
    return {
      id: `high-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'drift',
      title: `Time to reconnect with ${friend.name}`,
      subtitle: `Your connection is cooling. ${getArchetypeDriftSuggestion(friend.archetype)}`,
      actionLabel: 'Plan a Weave',
      icon: '🧵',
      action: {
        type: 'plan',
        prefilledCategory: getArchetypePreferredCategory(friend.archetype),
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 4: First weave (new friend)
  if (interactionCount === 0) {
    const daysSinceAdded = friend.createdAt
      ? (Date.now() - friend.createdAt.getTime()) / 86400000
      : 0;

    if (daysSinceAdded >= 1) {
      return {
        id: `first-weave-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'maintain',
        title: `A new thread with ${friend.name}`,
        subtitle: 'Log your first weave to begin strengthening this connection.',
        actionLabel: 'Log First Weave',
        icon: '🧵',
        action: { type: 'log' },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  // PRIORITY 5: Archetype mismatch insight
  const archetypeMismatch = checkArchetypeMismatch(friend, recentInteractions);
  if (archetypeMismatch) return archetypeMismatch;

  // PRIORITY 6: Momentum opportunity
  if (currentScore > 60 && momentumScore > 10) {
    const daysSinceLast = lastInteractionDate
      ? (Date.now() - lastInteractionDate.getTime()) / 86400000
      : 999;

    if (daysSinceLast <= 7) {
      return {
        id: `momentum-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'deepen',
        title: `You're connecting well with ${friend.name}`,
        subtitle: `Ride this momentum! ${getArchetypeMomentumSuggestion(friend.archetype)}`,
        actionLabel: 'Deepen the Bond',
        icon: '🌟',
        action: {
          type: 'plan',
          prefilledCategory: getArchetypePreferredCategory(friend.archetype),
        },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  // PRIORITY 7: Maintenance
  const daysSinceInteraction = lastInteractionDate
    ? (Date.now() - lastInteractionDate.getTime()) / 86400000
    : 999;

  const maintenanceThreshold = {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier];

  if (currentScore >= 40 && currentScore <= 70 && daysSinceInteraction > maintenanceThreshold) {
    return {
      id: `maintenance-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'maintain',
      title: `Keep the thread warm with ${friend.name}`,
      subtitle: 'A simple text or voice note can maintain your connection.',
      actionLabel: 'Plan a Weave',
      icon: '💛',
      action: {
        type: 'plan',
        prefilledCategory: 'text-call',
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 8: Deepen (thriving)
  if (currentScore > 85 && friend.dunbarTier !== 'Community') {
    return {
      id: `deepen-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'celebrate',
      title: `Your bond with ${friend.name} is thriving`,
      subtitle: 'Plan something special to celebrate this connection.',
      actionLabel: 'Plan Something Meaningful',
      icon: '✨',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  return null;
}

function checkReflectSuggestion(
  friend: SuggestionInput['friend'],
  recentInteractions: SuggestionInput['recentInteractions']
): Suggestion | null {
  if (recentInteractions.length === 0) return null;

  const mostRecent = recentInteractions[0];
  const hoursSince = (Date.now() - mostRecent.interactionDate.getTime()) / 3600000;

  if (hoursSince < 24 && (!mostRecent.notes || !mostRecent.vibe)) {
    const activityLabel = mostRecent.category ? getCategoryLabel(mostRecent.category) : 'time together';

    return {
      id: `reflect-${mostRecent.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'reflect',
      title: 'Deepen this weave',
      subtitle: `How was your ${activityLabel} with ${friend.name}?`,
      actionLabel: 'Add Reflection',
      icon: '✨',
      action: {
        type: 'reflect',
        interactionId: mostRecent.id,
      },
      dismissible: true,
      createdAt: new Date(),
      expiresAt: new Date(mostRecent.interactionDate.getTime() + 48 * 3600000), // 48 hours
    };
  }

  return null;
}

function checkArchetypeMismatch(
  friend: SuggestionInput['friend'],
  recentInteractions: SuggestionInput['recentInteractions']
): Suggestion | null {
  if (recentInteractions.length < 3) return null;

  const last3 = recentInteractions.slice(0, 3);
  const preferredCategory = getArchetypePreferredCategory(friend.archetype);

  const hasPreferred = last3.some(i => i.category === preferredCategory);

  if (!hasPreferred) {
    const categoryLabel = preferredCategory.replace('-', ' ');
    return {
      id: `archetype-mismatch-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'medium',
      category: 'insight',
      title: `Missing ${friend.name}'s depth`,
      subtitle: `${friend.archetype} values certain types of connection. Your last 3 weaves didn't create space for that. Try ${categoryLabel}.`,
      actionLabel: 'Plan Deep Connection',
      icon: '💡',
      action: {
        type: 'plan',
        prefilledCategory: preferredCategory,
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  return null;
}

export function getSuggestionCooldownDays(suggestionId: string): number {
  if (suggestionId.startsWith('critical-drift')) return COOLDOWN_DAYS['critical-drift'];
  if (suggestionId.startsWith('high-drift')) return COOLDOWN_DAYS['high-drift'];
  if (suggestionId.startsWith('first-weave')) return COOLDOWN_DAYS['first-weave'];
  if (suggestionId.startsWith('archetype-mismatch')) return COOLDOWN_DAYS['archetype-mismatch'];
  if (suggestionId.startsWith('momentum')) return COOLDOWN_DAYS['momentum'];
  if (suggestionId.startsWith('maintenance')) return COOLDOWN_DAYS['maintenance'];
  if (suggestionId.startsWith('deepen')) return COOLDOWN_DAYS['deepen'];
  if (suggestionId.startsWith('reflect')) return COOLDOWN_DAYS['reflect'];
  return 3; // Default
}
