import { Suggestion, SuggestionInput } from '../types/suggestions';
import {
  getArchetypePreferredCategory,
  getArchetypeDriftSuggestion,
  getArchetypeMomentumSuggestion,
} from './archetype-content';
import { differenceInDays } from 'date-fns';

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
  'life-event': 1, // Show again tomorrow if still upcoming
  'archetype-mismatch': 3,
  'momentum': 7,
  'maintenance': 3,
  'deepen': 7,
  'reflect': 2,
};

// Archetype-specific celebration suggestions
const ARCHETYPE_CELEBRATION_SUGGESTIONS: Record<string, string[]> = {
  Emperor: ['Plan a structured celebration dinner', 'Organize a milestone celebration', 'Send a thoughtful, high-quality gift'],
  Empress: ['Host a cozy dinner party at your place', 'Bake or cook something special for them', 'Plan a comfort-focused celebration'],
  HighPriestess: ['Schedule a deep one-on-one conversation', 'Send a heartfelt, personal message', 'Arrange intimate tea or coffee time'],
  Fool: ['Plan a spontaneous surprise adventure', 'Throw an unexpected party', 'Organize something fun and playful'],
  Sun: ['Throw a big, energetic celebration', 'Host a vibrant party with others', 'Organize a group gathering in their honor'],
  Hermit: ['Schedule meaningful one-on-one quality time', 'Plan a quiet, thoughtful celebration', 'Arrange a peaceful walk or private dinner'],
  Magician: ['Collaborate on a creative celebration project', 'Plan a unique, experiential celebration', 'Create something special together'],
};

function getArchetypeCelebrationSuggestion(archetype: string): string {
  const suggestions = ARCHETYPE_CELEBRATION_SUGGESTIONS[archetype] || [
    'Reach out with a thoughtful message',
    'Plan a way to celebrate together',
  ];
  const randomIndex = Math.floor(Math.random() * suggestions.length);
  return suggestions[randomIndex];
}

interface LifeEventInfo {
  type: 'birthday' | 'anniversary';
  daysUntil: number;
}

function checkUpcomingLifeEvent(friend: SuggestionInput['friend']): LifeEventInfo | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check birthday (within 7 days)
  if (friend.birthday) {
    const birthdayThisYear = new Date(friend.birthday);
    birthdayThisYear.setFullYear(today.getFullYear());
    birthdayThisYear.setHours(0, 0, 0, 0);

    if (birthdayThisYear < today) {
      birthdayThisYear.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = differenceInDays(birthdayThisYear, today);
    if (daysUntil >= 0 && daysUntil <= 7) {
      return { type: 'birthday', daysUntil };
    }
  }

  // Check anniversary (within 7 days)
  if (friend.anniversary) {
    const anniversaryThisYear = new Date(friend.anniversary);
    anniversaryThisYear.setFullYear(today.getFullYear());
    anniversaryThisYear.setHours(0, 0, 0, 0);

    if (anniversaryThisYear < today) {
      anniversaryThisYear.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = differenceInDays(anniversaryThisYear, today);
    if (daysUntil >= 0 && daysUntil <= 7) {
      return { type: 'anniversary', daysUntil };
    }
  }

  return null;
}

function getDaysText(days: number): string {
  if (days === 0) return 'is today';
  if (days === 1) return 'is tomorrow';
  return `is in ${days} days`;
}

/**
 * Generates intelligent suggestions for a friend based on their interaction history,
 * relationship health, and upcoming life events.
 *
 * IMPORTANT: Only pass COMPLETED interactions (status === 'completed') that have already
 * occurred (interactionDate <= now). Planned/future interactions should never be included
 * in recentInteractions as they cannot be reflected upon or used for pattern analysis.
 */
export function generateSuggestion(input: SuggestionInput): Suggestion | null {
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions } = input;

  // Check for upcoming life event (used in multiple priorities)
  const lifeEvent = checkUpcomingLifeEvent(friend);

  // PRIORITY 1: Reflect on recent interaction (only past, completed interactions)
  const recentReflectSuggestion = checkReflectSuggestion(friend, recentInteractions);
  if (recentReflectSuggestion) return recentReflectSuggestion;

  // PRIORITY 2: Upcoming life event (birthday/anniversary within 7 days)
  if (lifeEvent) {
    const eventIcon = lifeEvent.type === 'birthday' ? '🎂' : '💝';
    const eventLabel = lifeEvent.type === 'birthday' ? 'birthday' : 'friendship anniversary';

    return {
      id: `life-event-${friend.id}-${lifeEvent.type}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: lifeEvent.daysUntil <= 1 ? 'high' : 'medium',
      category: 'life-event',
      title: `${friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`,
      subtitle: getArchetypeCelebrationSuggestion(friend.archetype),
      actionLabel: 'Plan Celebration',
      icon: eventIcon,
      action: {
        type: 'plan',
        prefilledCategory: 'celebration' as any,
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 3: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    return {
      id: `critical-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'drift',
      title: `${friend.name} is drifting away`,
      subtitle: lifeEvent
        ? `${getArchetypeDriftSuggestion(friend.archetype)} ${lifeEvent.type === 'birthday' ? '🎂' : '💝'} Their ${lifeEvent.type} ${getDaysText(lifeEvent.daysUntil)}.`
        : getArchetypeDriftSuggestion(friend.archetype),
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
      subtitle: lifeEvent
        ? `Your connection is cooling. ${getArchetypeDriftSuggestion(friend.archetype)} ${lifeEvent.type === 'birthday' ? '🎂' : '💝'} Their ${lifeEvent.type} ${getDaysText(lifeEvent.daysUntil)}.`
        : `Your connection is cooling. ${getArchetypeDriftSuggestion(friend.archetype)}`,
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
  const now = Date.now();
  const hoursSince = (now - mostRecent.interactionDate.getTime()) / 3600000;

  // Only suggest reflection for PAST interactions (not future/planned)
  // Interaction must be in the past and within 24 hours
  if (mostRecent.interactionDate.getTime() > now) {
    return null; // Future interaction, can't reflect yet
  }

  // Must be recent (within 24 hours) and missing reflection data
  if (hoursSince < 24 && hoursSince >= 0 && (!mostRecent.notes || !mostRecent.vibe)) {
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

  // Filter to only past interactions (recentInteractions should already be filtered to completed,
  // but adding this as extra safety)
  const now = Date.now();
  const pastInteractions = recentInteractions.filter(i => i.interactionDate.getTime() <= now);

  if (pastInteractions.length < 3) return null;

  const last3 = pastInteractions.slice(0, 3);
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
  if (suggestionId.startsWith('life-event')) return COOLDOWN_DAYS['life-event'];
  if (suggestionId.startsWith('archetype-mismatch')) return COOLDOWN_DAYS['archetype-mismatch'];
  if (suggestionId.startsWith('momentum')) return COOLDOWN_DAYS['momentum'];
  if (suggestionId.startsWith('maintenance')) return COOLDOWN_DAYS['maintenance'];
  if (suggestionId.startsWith('deepen')) return COOLDOWN_DAYS['deepen'];
  if (suggestionId.startsWith('reflect')) return COOLDOWN_DAYS['reflect'];
  return 3; // Default
}
