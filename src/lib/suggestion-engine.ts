import { Suggestion, SuggestionInput } from '../types/suggestions';
import {
  getArchetypePreferredCategory,
  getArchetypeDriftSuggestion,
  getArchetypeMomentumSuggestion,
} from './archetype-content';
import { differenceInDays } from 'date-fns';
import { database } from '../db';
import LifeEvent, { LifeEventType } from '../db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import {
  analyzeInteractionPattern,
  calculateToleranceWindow,
  isPatternReliable,
  getPatternDescription,
  type FriendshipPattern,
} from './pattern-analyzer';
import {
  type FriendshipPortfolio,
  type PortfolioImbalance,
} from './portfolio-analyzer';
import {
  type ProactiveSuggestion,
} from './predictive-insights';

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
  type: 'birthday' | 'anniversary' | LifeEventType;
  daysUntil: number;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  title?: string;
}

async function checkUpcomingLifeEvent(friend: SuggestionInput['friend']): Promise<LifeEventInfo | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // First check database for detected life events (highest priority if critical)
  try {
    const activeLifeEvents = await database
      .get<LifeEvent>('life_events')
      .query(
        // @ts-ignore
        Q.where('friend_id', friend.id),
        Q.or(
          // Upcoming events (within next 30 days)
          Q.and(
            Q.where('event_date', Q.gte(today.getTime())),
            Q.where('event_date', Q.lte(today.getTime() + 30 * 24 * 60 * 60 * 1000))
          ),
          // Recent past events needing follow-up (last 7 days)
          Q.and(
            Q.where('event_date', Q.gte(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
            Q.where('event_date', Q.lt(today.getTime()))
          )
        )
      )
      .fetch();

    console.log('[LifeEvent Check] Found life events for', friend.name, ':', activeLifeEvents.map(e => ({
      type: e.eventType,
      date: new Date(e.eventDate).toISOString(),
      title: e.title,
      importance: e.importance,
    })));

    // Filter out anniversaries for non-partners
    const filteredEvents = activeLifeEvents.filter(event => {
      if (event.eventType === 'anniversary') {
        const isPartner = friend.relationshipType?.toLowerCase().includes('partner');
        console.log('[LifeEvent Check] Anniversary event found - relationshipType:', friend.relationshipType, 'isPartner:', isPartner);
        return isPartner;
      }
      return true;
    });

    console.log('[LifeEvent Check] After filtering:', filteredEvents.length, 'events remain');

    // Prioritize critical and high importance events
    const sortedEvents = filteredEvents.sort((a, b) => {
      const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = importanceOrder[a.importance];
      const bScore = importanceOrder[b.importance];
      if (aScore !== bScore) return bScore - aScore;
      // If same importance, prioritize by proximity
      return Math.abs(differenceInDays(a.eventDate, today)) - Math.abs(differenceInDays(b.eventDate, today));
    });

    if (sortedEvents.length > 0) {
      const topEvent = sortedEvents[0];
      const daysUntil = differenceInDays(topEvent.eventDate, today);

      return {
        type: topEvent.eventType,
        daysUntil,
        importance: topEvent.importance,
        title: topEvent.title,
      };
    }
  } catch (error) {
    console.error('Error checking life events:', error);
  }

  // Fallback to legacy birthday/anniversary checks from Friend model
  console.log('[Friend Field Check]', friend.name, '- birthday:', !!friend.birthday, 'anniversary:', !!friend.anniversary, 'relationshipType:', friend.relationshipType);

  // Check birthday (within 7 days)
  if (friend.birthday) {
    const birthdayThisYear = new Date(friend.birthday);

    // Validate that we have a valid date
    if (isNaN(birthdayThisYear.getTime())) {
      console.warn('Invalid birthday date for friend:', friend.id);
      return null;
    }

    birthdayThisYear.setFullYear(today.getFullYear());
    birthdayThisYear.setHours(0, 0, 0, 0);

    if (birthdayThisYear < today) {
      birthdayThisYear.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = differenceInDays(birthdayThisYear, today);

    // Extra validation check
    if (isNaN(daysUntil)) {
      console.warn('Invalid daysUntil calculation for birthday:', friend.id);
      return null;
    }

    if (daysUntil >= 0 && daysUntil <= 7) {
      return { type: 'birthday', daysUntil, importance: 'high' };
    }
  }

  // Check anniversary (within 14 days) - only for partners
  if (friend.anniversary) {
    console.log('[Anniversary Check] Friend has anniversary field:', {
      friendName: friend.name,
      anniversary: friend.anniversary,
      relationshipType: friend.relationshipType,
      relationshipTypeLower: friend.relationshipType?.toLowerCase(),
      includesPartner: friend.relationshipType?.toLowerCase().includes('partner'),
    });

    if (!friend.relationshipType?.toLowerCase().includes('partner')) {
      console.log('[Anniversary Check] Skipping - not a partner');
      return null;
    }

    const anniversaryThisYear = new Date(friend.anniversary);

    // Validate that we have a valid date
    if (isNaN(anniversaryThisYear.getTime())) {
      console.warn('[Anniversary Check] Invalid anniversary date for friend:', friend.id, friend.anniversary);
      return null;
    }

    anniversaryThisYear.setFullYear(today.getFullYear());
    anniversaryThisYear.setHours(0, 0, 0, 0);

    if (anniversaryThisYear < today) {
      anniversaryThisYear.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = differenceInDays(anniversaryThisYear, today);

    console.log('[Anniversary Check]', {
      friendName: friend.name,
      originalDate: friend.anniversary,
      thisYearDate: anniversaryThisYear.toISOString(),
      today: today.toISOString(),
      daysUntil,
      relationshipType: friend.relationshipType,
    });

    // Extra validation check
    if (isNaN(daysUntil)) {
      console.warn('[Anniversary Check] Invalid daysUntil calculation for anniversary:', friend.id);
      return null;
    }

    if (daysUntil >= 0 && daysUntil <= 14) {
      console.log('[Anniversary Check] Returning anniversary suggestion for', friend.name, 'in', daysUntil, 'days');
      return { type: 'anniversary', daysUntil, importance: 'medium' };
    }

    console.log('[Anniversary Check] Anniversary not within 14 days, skipping');
  }

  return null;
}

// Get appropriate emoji and label for life event type
function getLifeEventDisplay(eventType: LifeEventType | 'birthday' | 'anniversary'): { icon: string; label: string } {
  const displays: Record<string, { icon: string; label: string }> = {
    birthday: { icon: '🎂', label: 'birthday' },
    anniversary: { icon: '💝', label: 'anniversary' },
    new_job: { icon: '💼', label: 'new job' },
    moving: { icon: '📦', label: 'move' },
    wedding: { icon: '💒', label: 'wedding' },
    baby: { icon: '👶', label: 'new baby' },
    loss: { icon: '🕊️', label: 'difficult time' },
    health_event: { icon: '🏥', label: 'health event' },
    graduation: { icon: '🎓', label: 'graduation' },
    celebration: { icon: '🎉', label: 'milestone' },
    other: { icon: '✨', label: 'life event' },
  };
  return displays[eventType] || { icon: '✨', label: 'life event' };
}

// Get appropriate suggestion text for event type
function getLifeEventSuggestion(eventType: LifeEventType | 'birthday' | 'anniversary', archetype: string, isPast: boolean): string {
  if (isPast) {
    // Follow-up suggestions for past events
    const followUps: Record<string, string> = {
      wedding: 'Check in on how married life is going',
      baby: 'See how they\'re adjusting to parenthood',
      new_job: 'Ask how the new role is going',
      moving: 'See how they\'re settling into the new place',
      loss: 'Offer support and check how they\'re doing',
      health_event: 'Check in on their recovery',
      graduation: 'Celebrate their achievement',
    };
    return followUps[eventType] || 'Check in and see how they\'re doing';
  }

  // Use archetype-specific celebration for birthdays
  if (eventType === 'birthday' || eventType === 'anniversary') {
    return getArchetypeCelebrationSuggestion(archetype);
  }

  // Proactive suggestions for upcoming events
  const suggestions: Record<string, string> = {
    wedding: 'Offer help with wedding planning or send congratulations',
    baby: 'Offer support or send a thoughtful gift',
    new_job: 'Send congratulations and encouragement',
    moving: 'Offer to help with the move or settling in',
    loss: 'Reach out with compassion and support',
    health_event: 'Offer support and check if they need anything',
    graduation: 'Plan a celebration or send congratulations',
    celebration: 'Celebrate this milestone together',
  };
  return suggestions[eventType] || 'Reach out to acknowledge this moment';
}

function getDaysText(days: number | undefined): string {
  if (days === undefined || isNaN(days)) return 'is coming up';
  if (days === 0) return 'is today';
  if (days === 1) return 'is tomorrow';
  return `is in ${days} days`;
}

/**
 * Analyzes past interactions to suggest specific, personalized activities
 * based on what this friendship has done before.
 */
function getContextualSuggestion(
  recentInteractions: SuggestionInput['recentInteractions'],
  archetype: string,
  tier: string,
  pattern?: FriendshipPattern
): string {
  // Use learned pattern preferences if available
  if (pattern && pattern.preferredCategories.length > 0) {
    const preferredCategory = pattern.preferredCategories[0];
    const suggestions: Record<string, string[]> = {
      'text-call': [
        "Send them a quick text like you used to",
        "Give them a call to catch up",
        "Drop them a voice note",
        "Send a funny meme or memory",
      ],
      'meal-drink': [
        "Grab coffee at your usual spot",
        "Plan dinner like old times",
        "Meet for drinks and catch up",
        "Grab lunch together this week",
      ],
      'hangout': [
        "Hang out like you used to",
        "Plan a chill hangout session",
        "Meet up for quality time",
        "Do something spontaneous together",
      ],
      'deep-talk': [
        "Have a heart-to-heart conversation",
        "Set aside time for a deep catch-up",
        "Schedule a meaningful conversation",
        "Create space for vulnerable sharing",
      ],
      'activity-hobby': [
        "Do that activity you both love",
        "Revisit your shared hobby together",
        "Plan an adventure like you used to",
        "Get active together again",
      ],
      'event-party': [
        "Invite them to something fun",
        "Plan a celebration together",
        "Organize a group hangout",
        "Go to an event together",
      ],
    };

    const options = suggestions[preferredCategory] || [];
    if (options.length > 0) {
      return options[Math.floor(Math.random() * options.length)];
    }
  }

  // Count interaction types to find patterns (fallback)
  const categoryCounts: Record<string, number> = {};
  recentInteractions.forEach(i => {
    if (i.category) {
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    }
  });

  // Get most common interaction type
  const mostCommon = Object.entries(categoryCounts).sort(([,a], [,b]) => b - a)[0];

  // Contextual suggestions based on their history + archetype
  const suggestions: Record<string, string[]> = {
    'text-call': [
      "Send them a quick text like you used to",
      "Give them a call to catch up",
      "Drop them a voice note",
      "Send a funny meme or memory",
    ],
    'meal-drink': [
      "Grab coffee at your usual spot",
      "Plan dinner like old times",
      "Meet for drinks and catch up",
      "Grab lunch together this week",
    ],
    'hangout': [
      "Hang out like you used to",
      "Plan a chill hangout session",
      "Meet up for quality time",
      "Do something spontaneous together",
    ],
    'deep-talk': [
      "Have a heart-to-heart conversation",
      "Set aside time for a deep catch-up",
      "Schedule a meaningful conversation",
      "Create space for vulnerable sharing",
    ],
    'activity-hobby': [
      "Do that activity you both love",
      "Revisit your shared hobby together",
      "Plan an adventure like you used to",
      "Get active together again",
    ],
    'event-party': [
      "Invite them to something fun",
      "Plan a celebration together",
      "Organize a group hangout",
      "Go to an event together",
    ],
  };

  // If they have a pattern, suggest continuing it
  if (mostCommon && mostCommon[1] >= 2) {
    const [category, count] = mostCommon;
    const options = suggestions[category] || [];
    if (options.length > 0) {
      return options[Math.floor(Math.random() * options.length)];
    }
  }

  // Fallback to archetype + tier appropriate suggestions
  if (tier === 'InnerCircle') {
    const innerCircleSuggestions = [
      "Set aside real quality time",
      "Plan something meaningful together",
      "Have a proper catch-up",
      "Make time for a deep connection",
    ];
    return innerCircleSuggestions[Math.floor(Math.random() * innerCircleSuggestions.length)];
  } else if (tier === 'CloseFriends') {
    const closeFriendSuggestions = [
      "Reach out with a thoughtful message",
      "Plan a casual meet-up",
      "Grab coffee or a quick bite",
      "Send a text to check in",
    ];
    return closeFriendSuggestions[Math.floor(Math.random() * closeFriendSuggestions.length)];
  } else {
    return "Send them a friendly message";
  }
}

/**
 * Generates intelligent suggestions for a friend based on their interaction history,
 * relationship health, and upcoming life events.
 *
 * IMPORTANT: Only pass COMPLETED interactions (status === 'completed') that have already
 * occurred (interactionDate <= now). Planned/future interactions should never be included
 * in recentInteractions as they cannot be reflected upon or used for pattern analysis.
 */
export async function generateSuggestion(input: SuggestionInput): Promise<Suggestion | null> {
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions } = input;

  // Analyze friendship pattern from interaction history
  const pattern = analyzeInteractionPattern(
    recentInteractions.map(i => ({
      id: i.id,
      interactionDate: i.interactionDate,
      status: 'completed',
      category: i.category,
    }))
  );

  // Check for upcoming life event (used in multiple priorities)
  const lifeEvent = await checkUpcomingLifeEvent(friend);

  // PRIORITY 1: Reflect on recent interaction (only past, completed interactions)
  const recentReflectSuggestion = checkReflectSuggestion(friend, recentInteractions);
  if (recentReflectSuggestion) return recentReflectSuggestion;

  // PRIORITY 2: Upcoming life event (birthday within 7 days, anniversary within 14 days)
  if (lifeEvent) {
    // Map life event types to appropriate icons and labels
    const eventIconMap: Record<string, string> = {
      birthday: '🎂',
      anniversary: '💝',
      new_job: '💼',
      moving: '🏠',
      graduation: '🎓',
      health_event: '🏥',
      celebration: '🎉',
      loss: '🕊️',
      wedding: '💒',
      baby: '👶',
    };

    const eventLabelMap: Record<string, string> = {
      birthday: 'birthday',
      anniversary: 'anniversary',
      new_job: 'new job',
      moving: 'move',
      graduation: 'graduation',
      health_event: 'health event',
      celebration: 'celebration',
      loss: 'loss',
      wedding: 'wedding',
      baby: 'baby',
    };

    const eventIcon = eventIconMap[lifeEvent.type] || '📅';
    const eventLabel = lifeEvent.title || eventLabelMap[lifeEvent.type] || lifeEvent.type;
    const isPast = lifeEvent.daysUntil < 0;

    // Use archetype-specific suggestions for birthdays/anniversaries, otherwise use life event specific
    const subtitle = (lifeEvent.type === 'birthday' || lifeEvent.type === 'anniversary')
      ? getArchetypeCelebrationSuggestion(friend.archetype)
      : getLifeEventSuggestion(lifeEvent.type, friend.archetype, isPast);

    // Different title and action for past vs upcoming events
    const title = isPast
      ? `Check in on ${friend.name}'s ${eventLabel}`
      : `${friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`;

    const actionLabel = isPast ? 'Reach Out' : 'Plan Celebration';

    return {
      id: `life-event-${friend.id}-${lifeEvent.type}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: lifeEvent.daysUntil <= 1 ? 'high' : 'medium',
      category: 'life-event',
      title,
      subtitle,
      actionLabel,
      icon: eventIcon,
      action: {
        type: isPast ? 'log' : 'plan',
        prefilledCategory: 'celebration' as any,
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 3: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);
    const eventContext = lifeEvent
      ? ` ${lifeEvent.type === 'birthday' ? '🎂' : '💝'} Their ${lifeEvent.type} ${getDaysText(lifeEvent.daysUntil)}.`
      : '';

    // Add pattern-aware context if available
    const patternContext = isPatternReliable(pattern)
      ? ` You usually connect ${getPatternDescription(pattern)}.`
      : '';

    return {
      id: `critical-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'drift',
      title: `${friend.name} is drifting away`,
      subtitle: `${contextualAction}.${patternContext}${eventContext}`,
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

  // PRIORITY 4: High drift (attention needed)
  const isHighDrift =
    (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
    (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

  if (isHighDrift) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);
    const eventContext = lifeEvent
      ? ` ${lifeEvent.type === 'birthday' ? '🎂' : '💝'} Their ${lifeEvent.type} ${getDaysText(lifeEvent.daysUntil)}.`
      : '';

    // Add pattern-aware context
    const patternContext = isPatternReliable(pattern)
      ? ` You usually connect ${getPatternDescription(pattern)}.`
      : '';

    return {
      id: `high-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'drift',
      title: `Time to reconnect with ${friend.name}`,
      subtitle: `${contextualAction}.${patternContext}${eventContext}`,
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
      const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

      return {
        id: `momentum-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'deepen',
        title: `You're connecting well with ${friend.name}`,
        subtitle: `Ride this momentum! ${contextualAction}`,
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

  // Use learned pattern for threshold, or fall back to tier defaults
  const maintenanceThreshold = isPatternReliable(pattern)
    ? calculateToleranceWindow(pattern)
    : {
        InnerCircle: 7,
        CloseFriends: 14,
        Community: 21,
      }[friend.dunbarTier];

  if (currentScore >= 40 && currentScore <= 70 && daysSinceInteraction > maintenanceThreshold) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

    // Create pattern-aware title
    const title = isPatternReliable(pattern)
      ? `Time for your ${pattern.averageIntervalDays}-day check-in with ${friend.name}`
      : `Keep the thread warm with ${friend.name}`;

    return {
      id: `maintenance-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'maintain',
      title,
      subtitle: contextualAction,
      actionLabel: 'Plan a Weave',
      icon: '💛',
      action: {
        type: 'plan',
        prefilledCategory: pattern.preferredCategories[0] || 'text-call',
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 8: Deepen (thriving)
  if (currentScore > 85 && friend.dunbarTier !== 'Community') {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

    return {
      id: `deepen-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'celebrate',
      title: `Your bond with ${friend.name} is thriving`,
      subtitle: `Celebrate this connection! ${contextualAction}`,
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
  if (suggestionId.startsWith('portfolio')) return 7; // Portfolio insights weekly
  if (suggestionId.startsWith('proactive-')) return 2; // Proactive predictions refresh often
  return 3; // Default
}

/**
 * Generates portfolio-level suggestions based on network-wide imbalances
 * These are shown alongside individual friend suggestions to provide holistic guidance
 */
export function generatePortfolioSuggestions(portfolio: FriendshipPortfolio): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Process each imbalance
  portfolio.imbalances.forEach(imbalance => {
    const suggestion = convertImbalanceToSuggestion(imbalance, portfolio);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  });

  return suggestions;
}

/**
 * Converts a portfolio imbalance into an actionable suggestion
 */
function convertImbalanceToSuggestion(
  imbalance: PortfolioImbalance,
  portfolio: FriendshipPortfolio
): Suggestion | null {
  const baseId = `portfolio-${imbalance.type}`;

  switch (imbalance.type) {
    case 'inner-circle-drift':
      return {
        id: `${baseId}-inner-circle`,
        friendId: '', // Portfolio suggestions aren't tied to a specific friend
        friendName: '',
        urgency: imbalance.severity === 'critical' ? 'critical' : 'high',
        category: 'portfolio',
        title: imbalance.title,
        subtitle: imbalance.description,
        actionLabel: 'View Inner Circle',
        icon: '⚠️',
        action: { type: 'plan' }, // Could navigate to Inner Circle view
        dismissible: imbalance.severity !== 'critical',
        createdAt: new Date(),
      };

    case 'tier-neglect':
      return {
        id: `${baseId}-${imbalance.affectedTier}`,
        friendId: '',
        friendName: '',
        urgency: imbalance.severity === 'high' ? 'high' : 'medium',
        category: 'portfolio',
        title: imbalance.title,
        subtitle: imbalance.recommendedAction,
        actionLabel: `View ${imbalance.affectedTier}`,
        icon: '📊',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };

    case 'overcommitment':
      return {
        id: baseId,
        friendId: '',
        friendName: '',
        urgency: 'medium',
        category: 'portfolio',
        title: imbalance.title,
        subtitle: imbalance.recommendedAction,
        actionLabel: 'Review Network',
        icon: '🧘',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };

    case 'monotony':
      return {
        id: baseId,
        friendId: '',
        friendName: '',
        urgency: 'low',
        category: 'portfolio',
        title: imbalance.title,
        subtitle: imbalance.recommendedAction,
        actionLabel: 'Explore Ideas',
        icon: '🎨',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };

    case 'lack-diversity':
      return {
        id: baseId,
        friendId: '',
        friendName: '',
        urgency: 'low',
        category: 'portfolio',
        title: imbalance.title,
        subtitle: imbalance.recommendedAction,
        actionLabel: 'Try Something New',
        icon: '🌈',
        action: { type: 'plan' },
        dismissible: true,
        createdAt: new Date(),
      };

    default:
      return null;
  }
}

/**
 * Converts proactive predictions into standard suggestion format
 * These are shown alongside other suggestions to provide forward-looking guidance
 */
export function convertProactiveSuggestionsToSuggestions(
  proactiveSuggestions: ProactiveSuggestion[]
): Suggestion[] {
  return proactiveSuggestions.map(proactive => {
    const baseId = `proactive-${proactive.type}-${proactive.friendId}`;

    // Map proactive type to icon
    const iconMap: Record<ProactiveSuggestion['type'], string> = {
      'upcoming-drift': '⏰',
      'optimal-timing': '🎯',
      'pattern-break': '⚠️',
      'momentum-opportunity': '🚀',
    };

    // Map proactive type to category
    const categoryMap: Record<ProactiveSuggestion['type'], Suggestion['category']> = {
      'upcoming-drift': 'drift',
      'optimal-timing': 'maintain',
      'pattern-break': 'drift',
      'momentum-opportunity': 'deepen',
    };

    return {
      id: baseId,
      friendId: proactive.friendId,
      friendName: proactive.friendName,
      urgency: proactive.urgency,
      category: categoryMap[proactive.type],
      title: proactive.title,
      subtitle: proactive.message,
      actionLabel: proactive.type === 'upcoming-drift' ? 'Reach Out Now' : 'Plan Weave',
      icon: iconMap[proactive.type],
      action: { type: 'plan' },
      dismissible: proactive.urgency !== 'critical',
      createdAt: new Date(),
    };
  });
}
