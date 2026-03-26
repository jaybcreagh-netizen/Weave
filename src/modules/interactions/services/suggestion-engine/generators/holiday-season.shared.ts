import type { Suggestion } from '@/shared/types/common';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';
import type { UpcomingHoliday } from '@/modules/intelligence/services/calendar-season';
import { getUpcomingHolidays } from '@/modules/intelligence/services/calendar-season';
import {
  getArchetypeHolidaySuggestion,
  getHolidaySuggestionTitle,
  getHolidaySuggestionSubtitle,
} from '@/modules/intelligence/services/calendar-season/seasonal-prompts';
import { daysSince } from '@/shared/utils/date-utils';

interface HolidayDescriptor {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel: string;
  action: Suggestion['action'];
  suggestionType: Suggestion['type'];
  suggestionCategory: string;
  opportunityCategory: Opportunity['category'];
  generatorSource: string;
  urgency: NonNullable<Suggestion['urgency']>;
  urgencyScore: number;
  confidence: number;
  effortLevel: Opportunity['effortLevel'];
  estimatedDurationMinutes: number;
  bestWindow: Opportunity['timeRelevance']['bestWindow'];
  expiresAt: number;
  whyThisFriend: string;
  whyThisAction: string;
  holidayName: string;
}

function isHolidayRelevantForFriend(
  holiday: UpcomingHoliday,
  friend: SuggestionContext['friend']
): boolean {
  const { category } = holiday.holiday;
  const relationshipType = friend.relationshipType?.toLowerCase() || '';

  if (holiday.holiday.id.includes('mothers-day') || holiday.holiday.id.includes('fathers-day')) {
    return relationshipType.includes('family') || relationshipType.includes('parent');
  }

  if (holiday.holiday.id === 'valentines-day') {
    return relationshipType.includes('partner')
      || friend.dunbarTier === 'InnerCircle'
      || friend.dunbarTier === 'CloseFriends';
  }

  if (holiday.holiday.id === 'galentines-day') {
    return !relationshipType.includes('partner');
  }

  if (category === 'major') {
    return friend.dunbarTier === 'InnerCircle' || friend.dunbarTier === 'CloseFriends';
  }

  if (category === 'gratitude') {
    return friend.dunbarTier === 'InnerCircle';
  }

  if (category === 'seasonal') {
    return friend.dunbarTier === 'InnerCircle' || friend.dunbarTier === 'CloseFriends';
  }

  if (holiday.holiday.id === 'friendship-day') {
    return true;
  }

  if (category === 'cultural') {
    return friend.dunbarTier === 'InnerCircle';
  }

  return true;
}

function selectBestHoliday(context: SuggestionContext): UpcomingHoliday | null {
  if (context.lastInteractionDate && daysSince(context.lastInteractionDate) < 2) {
    return null;
  }

  const upcomingHolidays = getUpcomingHolidays({
    now: context.now,
    maxDaysAhead: 14,
  });

  for (const holiday of upcomingHolidays) {
    if (!holiday.isWithinLeadTime) {
      continue;
    }

    if (!isHolidayRelevantForFriend(holiday, context.friend)) {
      continue;
    }

    return holiday;
  }

  return null;
}

function getPrefilledCategory(holiday: UpcomingHoliday): string {
  const { category, id } = holiday.holiday;

  if (id === 'valentines-day' || id === 'galentines-day') {
    return 'meal-drink';
  }

  if (category === 'major') {
    return 'celebration';
  }

  if (category === 'gratitude') {
    return 'deep-talk';
  }

  return 'text-call';
}

function buildDescriptor(context: SuggestionContext): HolidayDescriptor | null {
  if (context.currentScore < 55) {
    return null;
  }

  const holiday = selectBestHoliday(context);
  if (!holiday) {
    return null;
  }

  const subtitle = context.friend.archetype
    ? getArchetypeHolidaySuggestion(context.friend.archetype, holiday.holiday.name)
    : getHolidaySuggestionSubtitle(holiday);

  const urgency: Suggestion['urgency'] = holiday.isToday
    ? 'high'
    : holiday.isTomorrow
      ? 'medium'
      : 'low';
  const effortLevel: Opportunity['effortLevel'] = holiday.isToday ? 'minimal' : 'moderate';
  const suggestionCategory = 'seasonal';
  const opportunityCategory: Opportunity['category'] = holiday.isToday || holiday.holiday.category === 'major'
    ? 'celebrate'
    : 'maintain';

  return {
    id: `holiday-${holiday.holiday.id}-${context.friend.id}`,
    title: getHolidaySuggestionTitle(context.friend.name, holiday),
    subtitle,
    icon: holiday.holiday.icon,
    actionLabel: holiday.isToday ? 'Reach Out' : 'Plan',
    action: {
      type: holiday.isToday ? 'log' : 'plan',
      prefilledCategory: getPrefilledCategory(holiday),
    },
    suggestionType: holiday.isToday ? 'celebrate' : 'connect',
    suggestionCategory,
    opportunityCategory,
    generatorSource: `holiday-${holiday.holiday.id}`,
    urgency,
    urgencyScore: holiday.isToday ? 72 : holiday.isTomorrow ? 50 : 32,
    confidence: 0.78,
    effortLevel,
    estimatedDurationMinutes: effortLevel === 'minimal' ? 10 : 25,
    bestWindow: holiday.isToday ? 'midday' : 'morning',
    expiresAt: holiday.date.getTime() + (24 * 60 * 60 * 1000),
    whyThisFriend: `${context.friend.name} is a good fit for this ${holiday.holiday.name} moment based on your relationship and timing.`,
    whyThisAction: holiday.isToday
      ? 'A quick same-day reach-out is the highest-value move for this holiday moment.'
      : 'Planning ahead makes it easier to follow through while the holiday still feels timely.',
    holidayName: holiday.holiday.name,
  };
}

export function buildHolidaySeasonSuggestion(context: SuggestionContext): Suggestion | null {
  const descriptor = buildDescriptor(context);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    friendId: context.friend.id,
    friendName: context.friend.name,
    type: descriptor.suggestionType,
    urgency: descriptor.urgency,
    category: descriptor.suggestionCategory,
    title: descriptor.title,
    subtitle: descriptor.subtitle,
    actionLabel: descriptor.actionLabel,
    icon: descriptor.icon,
    action: descriptor.action,
    dismissible: true,
    createdAt: context.now,
    expiresAt: new Date(descriptor.expiresAt),
  };
}

export function buildHolidaySeasonOpportunity(context: SuggestionContext): Opportunity | null {
  const descriptor = buildDescriptor(context);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    friendId: context.friend.id,
    friendName: context.friend.name,
    friendTier: context.friend.dunbarTier,
    category: descriptor.opportunityCategory,
    generatorSource: descriptor.generatorSource,
    urgency: descriptor.urgencyScore,
    confidence: descriptor.confidence,
    effortLevel: descriptor.effortLevel,
    estimatedDurationMinutes: descriptor.estimatedDurationMinutes,
    explanation: {
      whyNow: descriptor.subtitle,
      whyThisFriend: descriptor.whyThisFriend,
      whyThisAction: descriptor.whyThisAction,
    },
    timeRelevance: {
      bestWindow: descriptor.bestWindow,
      deadlineAt: descriptor.expiresAt,
      expiresAt: descriptor.expiresAt,
    },
    copyContext: {
      recentInteractionCategory: descriptor.action.prefilledCategory,
      vibeHint: descriptor.holidayName,
    },
    createdAt: context.now.getTime(),
  };
}
