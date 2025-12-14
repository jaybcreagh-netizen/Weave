import { Suggestion } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import { HydratedFriend } from '@/types/hydrated';

export interface SuggestionInput {
  friend: HydratedFriend;
  currentScore: number;
  lastInteractionDate: Date | null;
  interactionCount: number;
  momentumScore: number;
  recentInteractions: InteractionModel[];
  plannedInteractions?: InteractionModel[];
}
import {
  getArchetypePreferredCategory,
  getArchetypeDriftSuggestion,
  getArchetypeMomentumSuggestion,
  getArchetypeDriftTitle,
  getArchetypeDormantTitle,
  getArchetypeNewTitle,
  getArchetypeWarmingTitle,
  getArchetypeThrivingTitle,
} from '@/shared/constants/archetype-content';
import { differenceInDays, startOfDay } from 'date-fns';
import { database } from '@/db';
import LifeEvent, { LifeEventType } from '@/db/models/LifeEvent';
import { daysUntil, isPast as isPastService } from '@/modules/relationships';
import Intention from '@/db/models/Intention';
import { Q } from '@nozbe/watermelondb';
import {
  analyzeInteractionPattern,
  calculateToleranceWindow,
  isPatternReliable,
  getPatternDescription,
  getAllLearnedEffectiveness,
  type FriendshipPattern,
  type ProactiveSuggestion,
} from '@/modules/insights';
import { parseFlexibleDate } from '@/shared/utils/date-utils';

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

/**
 * Gets smart category recommendation based on learned effectiveness data.
 * Falls back to archetype preference if not enough data or no clear winner.
 * 
 * @param friend - The friend to get category for
 * @param minOutcomes - Minimum outcomes needed to trust learned data (default: 3)
 * @returns Category and whether it's learned
 */
function getSmartCategory(
  friend: HydratedFriend,
  minOutcomes: number = 3
): { category: string; isLearned: boolean } {
  const archetypePref = getArchetypePreferredCategory(friend.archetype);

  // Need minimum outcomes to trust learned data
  // Cast to FriendModel since HydratedFriend may not have outcomeCount
  const friendModel = friend as unknown as FriendModel;
  if ((friendModel.outcomeCount || 0) < minOutcomes) {
    return { category: archetypePref, isLearned: false };
  }

  const effectiveness = getAllLearnedEffectiveness(friendModel);

  // Find most effective category (must be 15%+ better than average)
  const sorted = Object.entries(effectiveness)
    .filter(([_, ratio]) => ratio > 1.15)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length > 0) {
    return {
      category: sorted[0][0],
      isLearned: true
    };
  }

  return { category: archetypePref, isLearned: false };
}

const COOLDOWN_DAYS = {
  'critical-drift': 1,
  'high-drift': 2,
  'first-weave': 2,
  'life-event': 1, // Show again tomorrow if still upcoming
  'intention-reminder': 2, // Remind about intentions every 2 days
  'archetype-mismatch': 3,
  'momentum': 7,
  'maintenance': 3,
  'deepen': 7,
  'reflect': 2,
  'planned-weave': 1,
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
  id: string; // Unique identifier for the life event (database ID or synthetic)
  type: 'birthday' | 'anniversary' | LifeEventType;
  daysUntil: number;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  title?: string;
}

async function checkUpcomingLifeEvent(friend: SuggestionInput['friend']): Promise<LifeEventInfo | null> {
  const today = startOfDay(new Date());

  // First check database for detected life events (highest priority if critical)
  try {
    const activeLifeEvents = await database
      .get<LifeEvent>('life_events')
      .query(
        // friend_id is dynamic
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

    // Filter out anniversaries for non-partners
    const filteredEvents = activeLifeEvents.filter(event => {
      if (event.eventType === 'anniversary') {
        const isPartner = friend.relationshipType?.toLowerCase().includes('partner');
        return isPartner;
      }
      return true;
    });

    // Prioritize critical and high importance events
    const sortedEvents = filteredEvents.sort((a, b) => {
      const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = importanceOrder[a.importance];
      const bScore = importanceOrder[b.importance];
      if (aScore !== bScore) return bScore - aScore;
      // If same importance, prioritize by proximity (normalize dates to avoid time-of-day issues)
      return Math.abs(differenceInDays(startOfDay(a.eventDate), today)) - Math.abs(differenceInDays(startOfDay(b.eventDate), today));
    });

    if (sortedEvents.length > 0) {
      const topEvent = sortedEvents[0];
      const daysUntil = differenceInDays(startOfDay(topEvent.eventDate), today);

      return {
        id: topEvent.id,
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
  // Check birthday (within 7 days)
  if (friend.birthday) {
    // Use flexible parser
    const dateParts = parseFlexibleDate(friend.birthday);

    if (!dateParts) {
      console.warn('Invalid birthday format for friend:', friend.id, friend.birthday);
      return null;
    }

    const { month, day } = dateParts;

    // Validate parsed values
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn('Invalid birthday date for friend:', friend.id, friend.birthday);
      return null;
    }

    // Create birthday for this year
    const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
    birthdayThisYear.setHours(0, 0, 0, 0);

    // If birthday already passed this year, use next year
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
      return { id: `birthday-${friend.id}`, type: 'birthday', daysUntil, importance: 'high' };
    }
  }

  // Check anniversary (within 14 days) - only for partners
  if (friend.anniversary) {
    if (!friend.relationshipType?.toLowerCase().includes('partner')) {
      return null;
    }

    const dateParts = parseFlexibleDate(friend.anniversary);

    if (!dateParts) {
      console.warn('[Anniversary Check] Invalid anniversary format for friend:', friend.id, friend.anniversary);
      return null;
    }

    const { month, day } = dateParts;

    // Validate parsed values
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn('[Anniversary Check] Invalid anniversary date for friend:', friend.id, friend.anniversary);
      return null;
    }

    // Create anniversary for this year
    const anniversaryThisYear = new Date(today.getFullYear(), month - 1, day);

    // Validate that we have a valid date
    if (isNaN(anniversaryThisYear.getTime())) {
      console.warn('[Anniversary Check] Invalid anniversary date for friend:', friend.id, friend.anniversary);
      return null;
    }
    anniversaryThisYear.setHours(0, 0, 0, 0);

    if (anniversaryThisYear < today) {
      anniversaryThisYear.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = differenceInDays(anniversaryThisYear, today);

    // Extra validation check
    if (isNaN(daysUntil)) {
      console.warn('[Anniversary Check] Invalid daysUntil calculation for anniversary:', friend.id);
      return null;
    }

    if (daysUntil >= 0 && daysUntil <= 14) {
      return { id: `anniversary-${friend.id}`, type: 'anniversary', daysUntil, importance: 'medium' };
    }
  }

  return null;
}

/**
 * Check if friend has any aging active intentions that should be reminded
 * Returns the oldest active intention if it's been 7+ days
 */
async function checkAgingIntention(friend: SuggestionInput['friend']): Promise<Intention | null> {
  const today = Date.now();
  const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);

  try {
    // Get all active intentions for this friend through the join table
    const intentionFriends = await database
      .get('intention_friends')
      .query(Q.where('friend_id', friend.id))
      .fetch();

    if (intentionFriends.length === 0) return null;

    // Get intention IDs
    const intentionIds = intentionFriends.map((ifriend: any) => ifriend._raw.intention_id);

    // Query for active intentions that are 7+ days old
    const agingIntentions = await database
      .get<Intention>('intentions')
      .query(
        Q.where('id', Q.oneOf(intentionIds)),
        Q.where('status', 'active'),
        Q.where('created_at', Q.lte(sevenDaysAgo)),
        Q.sortBy('created_at', Q.asc) // Oldest first
      )
      .fetch();

    if (agingIntentions.length > 0) {
      return agingIntentions[0]; // Return oldest intention
    }
  } catch (error) {
    console.error('Error checking aging intentions:', error);
  }

  return null;
}

// Get appropriate emoji and label for life event type
function getLifeEventDisplay(eventType: LifeEventType | 'birthday' | 'anniversary'): { icon: string; label: string } {
  const displays: Record<string, { icon: string; label: string }> = {
    birthday: { icon: 'Gift', label: 'birthday' },
    anniversary: { icon: 'Heart', label: 'anniversary' },
    new_job: { icon: 'Briefcase', label: 'new job' },
    moving: { icon: 'Home', label: 'move' },
    wedding: { icon: 'Heart', label: 'wedding' },
    baby: { icon: 'Egg', label: 'baby' }, // Using Egg as close proxy for new life or Smile
    loss: { icon: 'HeartCrack', label: 'difficult time' }, // HeartCrack or Sunrise
    health_event: { icon: 'Activity', label: 'health event' },
    graduation: { icon: 'GraduationCap', label: 'graduation' },
    celebration: { icon: 'PartyPopper', label: 'milestone' },
    other: { icon: 'Star', label: 'life event' },
  };
  return displays[eventType] || { icon: 'Star', label: 'life event' };
}

// Get appropriate suggestion text for event type
// Get appropriate suggestion text for event type
function getLifeEventSuggestion(eventType: LifeEventType | 'birthday' | 'anniversary', archetype: string, lifeEvent: LifeEventInfo): string {
  if (lifeEvent.daysUntil < 0) {
    // Follow-up suggestions for past events
    const followUps: Record<string, string> = {
      wedding: 'Check how married life is going',
      baby: 'See how they\'re adjusting',
      new_job: 'Ask how the new role is',
      moving: 'See how they\'re settling in',
      loss: 'Check how they\'re doing',
      health_event: 'Check on their recovery',
      graduation: 'Celebrate their achievement',
    };
    return followUps[eventType] || 'Check in with them';
  }

  // Use archetype-specific celebration for birthdays
  if (eventType === 'birthday' || eventType === 'anniversary') {
    return getArchetypeCelebrationSuggestion(archetype);
  }

  // Proactive suggestions for upcoming events
  const suggestions: Record<string, string> = {
    wedding: 'Offer help or congratulations',
    baby: 'Offer support or a gift',
    new_job: 'Send congrats',
    moving: 'Offer help with the move',
    loss: 'Reach out with support',
    health_event: 'Offer support',
    graduation: 'Congratulate them',
    celebration: 'Celebrate this milestone',
  };
  return suggestions[eventType] || 'Reach out';
}

function getDaysText(days: number | undefined): string {
  if (days === undefined || isNaN(days)) return 'soon';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
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
    if (i.interactionCategory) {
      categoryCounts[i.interactionCategory] = (categoryCounts[i.interactionCategory] || 0) + 1;
    }
  });

  // Get most common interaction type
  const mostCommon = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];

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
      "Set aside quality time",
      "Plan something meaningful",
      "Have a proper catch-up",
      "Make time for connection",
    ];
    return innerCircleSuggestions[Math.floor(Math.random() * innerCircleSuggestions.length)];
  } else if (tier === 'CloseFriends') {
    const closeFriendSuggestions = [
      "Send a thoughtful text",
      "Plan a casual meet-up",
      "Grab coffee or a bite",
      "Check in with them",
    ];
    return closeFriendSuggestions[Math.floor(Math.random() * closeFriendSuggestions.length)];
  } else {
    return "Send a friendly message";
  }
}

function checkPlannedWeaveSuggestion(
  friend: SuggestionInput['friend'],
  plannedInteractions: SuggestionInput['plannedInteractions']
): Suggestion | null {
  if (!plannedInteractions || plannedInteractions.length === 0) return null;

  const now = Date.now();
  // Filter for this friend (should already be filtered but safety first)
  // Sort by date ascending (soonest first)
  const relevantPlans = plannedInteractions.sort((a, b) => {
    const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
    const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
    return timeA - timeB;
  });

  for (const plan of relevantPlans) {
    const planTime = plan.interactionDate instanceof Date ? plan.interactionDate.getTime() : new Date(plan.interactionDate || 0).getTime();
    const hoursDiff = (planTime - now) / 3600000;

    // Past Due (within last 7 days)
    if (hoursDiff < 0 && hoursDiff > -168) {
      return {
        id: `past-plan-${plan.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'high',
        category: 'maintain',
        title: 'Did you meet?',
        subtitle: `You had a plan with ${friend.name} for ${getCategoryLabel(plan.interactionCategory || 'hangout')}. Mark it complete?`,
        actionLabel: 'Log Weave',
        icon: 'CheckCircle',
        action: {
          type: 'log',
          prefilledCategory: plan.interactionCategory as any,
        },
        dismissible: true,
        createdAt: new Date(),
        type: 'connect'
      };
    }

    // Upcoming (Next 48 hours)
    if (hoursDiff >= 0 && hoursDiff <= 48) {
      const timeText = hoursDiff < 24 ? 'today' : 'tomorrow';

      return {
        id: `upcoming-plan-${plan.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'plan',
        title: 'Upcoming Plan',
        subtitle: `You have a plan with ${friend.name} ${timeText}.`,
        actionLabel: 'View',
        icon: 'Calendar',
        action: {
          type: 'plan',
        },
        dismissible: true,
        createdAt: new Date(),
        type: 'connect'
      };
    }
  }

  return null;
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
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions, plannedInteractions } = input;

  // Analyze friendship pattern from interaction history
  const pattern = analyzeInteractionPattern(
    recentInteractions.map(i => ({
      id: i.id,
      interactionDate: i.interactionDate,
      status: 'completed',
      category: i.interactionCategory,
    }))
  );

  // Check for upcoming life event (used in multiple priorities)
  const lifeEvent = await checkUpcomingLifeEvent(friend);

  // Check for planned weaves
  const plannedWeaveSuggestion = checkPlannedWeaveSuggestion(friend, plannedInteractions);

  // PRIORITY 1: Past Due Planned Weaves (Immediate Action)
  if (plannedWeaveSuggestion && plannedWeaveSuggestion.id.startsWith('past-plan')) {
    return plannedWeaveSuggestion;
  }

  // PRIORITY 2: Urgent Life Events (Birthday/Anniversary Today or Tomorrow)
  if (lifeEvent && lifeEvent.daysUntil <= 1) {
    // Generate the life event suggestion immediately
    const eventIconMap: Record<string, string> = {
      birthday: 'Gift',
      anniversary: 'Heart',
      new_job: 'Briefcase',
      moving: 'Home',
      graduation: 'GraduationCap',
      health_event: 'Activity',
      celebration: 'PartyPopper',
      loss: 'HeartCrack',
      wedding: 'Heart',
      baby: 'Egg',
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

    const eventIcon = eventIconMap[lifeEvent.type] || 'Calendar';
    const eventLabel = lifeEvent.title || eventLabelMap[lifeEvent.type] || lifeEvent.type;

    const subtitle = (lifeEvent.type === 'birthday' || lifeEvent.type === 'anniversary')
      ? getArchetypeCelebrationSuggestion(friend.archetype)
      : getLifeEventSuggestion(lifeEvent.type, friend.archetype, lifeEvent);

    const title = lifeEvent.daysUntil < 0
      ? `Check in on ${friend.name}'s ${eventLabel}`
      : `${friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`;

    const actionLabel = lifeEvent.daysUntil < 0 ? 'Reach Out' : 'Plan';

    return {
      id: `life-event-${lifeEvent.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'life-event',
      title,
      subtitle,
      actionLabel,
      icon: eventIcon,
      action: {
        type: lifeEvent.daysUntil < 0 ? 'log' : 'plan',
        prefilledCategory: 'celebration' as any,
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'connect',
    };
  }

  // PRIORITY 3: Reflect on recent interaction (only past, completed interactions)
  const recentReflectSuggestion = checkReflectSuggestion(friend, recentInteractions);
  if (recentReflectSuggestion) return recentReflectSuggestion;

  // PRIORITY 4: Upcoming Planned Weaves (Reminder)
  if (plannedWeaveSuggestion) {
    return plannedWeaveSuggestion;
  }

  // PRIORITY 5: Upcoming life event (birthday within 7 days, anniversary within 14 days)
  if (lifeEvent) {
    // Map life event types to appropriate icons and labels
    const eventIconMap: Record<string, string> = {
      birthday: 'Gift',
      anniversary: 'Heart',
      new_job: 'Briefcase',
      moving: 'Home',
      graduation: 'GraduationCap',
      health_event: 'Activity',
      celebration: 'PartyPopper',
      loss: 'HeartCrack',
      wedding: 'Heart',
      baby: 'Egg', // Egg or Smile
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

    const eventIcon = eventIconMap[lifeEvent.type] || 'Calendar';
    const eventLabel = lifeEvent.title || eventLabelMap[lifeEvent.type] || lifeEvent.type;

    // Use archetype-specific suggestions for birthdays/anniversaries, otherwise use life event specific
    const subtitle = (lifeEvent.type === 'birthday' || lifeEvent.type === 'anniversary')
      ? getArchetypeCelebrationSuggestion(friend.archetype)
      : getLifeEventSuggestion(lifeEvent.type, friend.archetype, lifeEvent);

    // Different title and action for past vs upcoming events
    const title = lifeEvent.daysUntil < 0
      ? `Check in on ${friend.name}'s ${eventLabel}`
      : `${friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`;

    const actionLabel = lifeEvent.daysUntil < 0 ? 'Reach Out' : 'Plan';

    return {
      id: `life-event-${lifeEvent.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: lifeEvent.daysUntil <= 1 ? 'high' : 'medium',
      category: 'life-event',
      title,
      subtitle,
      actionLabel,
      icon: eventIcon,
      action: {
        type: lifeEvent.daysUntil < 0 ? 'log' : 'plan',
        prefilledCategory: 'celebration' as any,
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'connect',
    };
  }

  // PRIORITY 2.5: Aging intentions (gentle reminder to follow through)
  const agingIntention = await checkAgingIntention(friend);
  if (agingIntention) {
    const daysSinceCreated = differenceInDays(new Date(), agingIntention.createdAt);

    // Determine urgency based on age
    let urgency: 'medium' | 'high' = 'medium';
    if (daysSinceCreated >= 14) urgency = 'high';

    // Build subtitle with intention details
    const categoryHint = agingIntention.interactionCategory
      ? ` (${getCategoryLabel(agingIntention.interactionCategory)})`
      : '';

    const subtitle = agingIntention.description
      ? `"${agingIntention.description}"${categoryHint}`
      : `Complete your intention${categoryHint}`;

    return {
      id: `intention-reminder-${agingIntention.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency,
      category: 'maintain',
      title: `Intention for ${friend.name}`,
      subtitle,
      actionLabel: 'Schedule',
      icon: 'Target',
      action: {
        type: 'plan',
        prefilledCategory: agingIntention.interactionCategory as any,
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'connect',
    };
  }

  // PRIORITY 3: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

    // Add pattern-aware context if available
    const patternContext = isPatternReliable(pattern)
      ? ` ${getPatternDescription(pattern)}.`
      : '';

    return {
      id: `critical-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'drift',
      title: getArchetypeDormantTitle(friend.archetype, friend.name),
      subtitle: `${contextualAction}.${patternContext}`,
      actionLabel: 'Reach Out',
      icon: 'Wind',
      action: {
        type: 'log',
        prefilledCategory: getSmartCategory(friend).category,
        prefilledMode: 'detailed',
      },
      dismissible: false, // Too important to dismiss
      createdAt: new Date(),
      type: 'reconnect',
    };
  }

  // PRIORITY 4: High drift (attention needed)
  const isHighDrift =
    (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
    (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

  if (isHighDrift) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

    // Add pattern-aware context
    const patternContext = isPatternReliable(pattern)
      ? ` ${getPatternDescription(pattern)}.`
      : '';

    return {
      id: `high-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'drift',
      title: getArchetypeDriftTitle(friend.archetype, friend.name),
      subtitle: `${contextualAction}.${patternContext}`,
      actionLabel: 'Plan',
      icon: 'Wind',
      action: {
        type: 'plan',
        prefilledCategory: getSmartCategory(friend).category,
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'reconnect',
    };
  }

  // PRIORITY 4: First weave (new friend)
  if (interactionCount === 0) {
    const daysSinceAdded = friend.createdAt
      ? (Date.now() - friend.createdAt.getTime()) / 86400000
      : 0;

    if (daysSinceAdded >= 1) {
      // Reduce noise: Only suggest first weave for Community friends if their health is low (< 35)
      if (friend.dunbarTier === 'Community' && currentScore >= 35) {
        return null;
      }

      return {
        id: `first-weave-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'maintain',
        title: getArchetypeNewTitle(friend.archetype, friend.name),
        subtitle: 'Log your first interaction.',
        actionLabel: 'Log',
        icon: 'Sparkles',
        action: { type: 'log' },
        dismissible: true,
        createdAt: new Date(),
        type: 'connect',
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
        title: getArchetypeWarmingTitle(friend.archetype, friend.name),
        subtitle: `Ride the wave! ${contextualAction}`,
        actionLabel: 'Deepen',
        icon: 'Zap',
        action: {
          type: 'plan',
          prefilledCategory: getSmartCategory(friend).category,
        },
        dismissible: true,
        createdAt: new Date(),
        type: 'deepen',
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

  if (currentScore >= 40 && currentScore <= 70 && maintenanceThreshold && daysSinceInteraction > maintenanceThreshold) {
    const contextualAction = getContextualSuggestion(recentInteractions, friend.archetype, friend.dunbarTier, pattern);

    // Create pattern-aware title
    const title = isPatternReliable(pattern)
      ? `${pattern.averageIntervalDays}-day check-in: ${friend.name}`
      : `Keep warm with ${friend.name}`;

    return {
      id: `maintenance-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'maintain',
      title,
      subtitle: contextualAction,
      actionLabel: 'Plan',
      icon: 'Clock',
      action: {
        type: 'plan',
        prefilledCategory: pattern.preferredCategories[0] || 'text-call',
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'connect',
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
      title: getArchetypeThrivingTitle(friend.archetype, friend.name),
      subtitle: `Celebrate! ${contextualAction}`,
      actionLabel: 'Plan',
      icon: 'Sparkles',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
      type: 'celebrate',
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
  if (!mostRecent.interactionDate) return null;
  const interactionTime = mostRecent.interactionDate.getTime();
  const hoursSince = (now - interactionTime) / 3600000;

  // Only suggest reflection for PAST interactions (not future/planned)
  // Interaction must be in the past and within 24 hours
  if (interactionTime > now) {
    return null; // Future interaction, can't reflect yet
  }

  // Must be recent (within 24 hours) and missing reflection data
  if (hoursSince < 24 && hoursSince >= 0 && (!mostRecent.note || !mostRecent.vibe)) {
    const activityLabel = mostRecent.interactionCategory ? getCategoryLabel(mostRecent.interactionCategory) : 'time together';

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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24h
      type: 'reflect',
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
  const pastInteractions = recentInteractions.filter(i => i.interactionDate && i.interactionDate.getTime() <= now);

  if (pastInteractions.length < 3) return null;

  const last3 = pastInteractions.slice(0, 3);
  const preferredCategory = getArchetypePreferredCategory(friend.archetype);

  const hasPreferred = last3.some(i => i.interactionCategory === preferredCategory);

  if (!hasPreferred) {
    const categoryLabel = preferredCategory.replace('-', ' ');
    return {
      id: `archetype-mismatch-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      type: 'reflect',
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
  if (suggestionId.startsWith('intention-reminder')) return COOLDOWN_DAYS['intention-reminder'];
  if (suggestionId.startsWith('archetype-mismatch')) return COOLDOWN_DAYS['archetype-mismatch'];
  if (suggestionId.startsWith('momentum')) return COOLDOWN_DAYS['momentum'];
  if (suggestionId.startsWith('maintenance')) return COOLDOWN_DAYS['maintenance'];
  if (suggestionId.startsWith('deepen')) return COOLDOWN_DAYS['deepen'];
  if (suggestionId.startsWith('reflect')) return COOLDOWN_DAYS['reflect'];
  if (suggestionId.startsWith('past-plan') || suggestionId.startsWith('upcoming-plan')) return COOLDOWN_DAYS['planned-weave'];
  if (suggestionId.startsWith('portfolio')) return 7; // Portfolio insights weekly
  if (suggestionId.startsWith('proactive-')) return 2; // Proactive predictions refresh often
  return 3; // Default
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
      'reciprocity-imbalance': '⚖️',
      'best-day-scheduling': '📅',
    };

    // Map proactive type to category
    const categoryMap: Record<ProactiveSuggestion['type'], Suggestion['category']> = {
      'upcoming-drift': 'drift',
      'optimal-timing': 'maintain',
      'pattern-break': 'reconnect',
      'momentum-opportunity': 'deepen',
      'reciprocity-imbalance': 'insight',
      'best-day-scheduling': 'plan',
    };

    return {
      id: baseId,
      friendId: proactive.friendId,
      friendName: proactive.friendName,
      urgency: proactive.urgency,
      category: categoryMap[proactive.type],
      title: proactive.title,
      subtitle: proactive.message,
      actionLabel: 'View Insight',
      icon: iconMap[proactive.type],
      action: {
        type: 'connect', // Default action type
      },
      dismissible: true,
      createdAt: new Date(),
      type: 'connect',
    };
  });
}
