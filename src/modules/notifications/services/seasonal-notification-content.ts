/**
 * Seasonal Notification Content Service
 *
 * Provides dynamically enhanced notification content based on
 * calendar season and upcoming holidays. Integrates with existing
 * notification channels to add seasonal flavor without changing config.
 */

import {
  getNextActionableHoliday,
  getCurrentCalendarSeason,
  isHighConnectionPeriod,
  UpcomingHoliday,
} from '@/modules/intelligence/services/calendar-season';
import {
  getSeasonalBatteryPrompt,
  getSeasonalDigestIntro,
  getSeasonalReflectionPrompts,
} from '@/modules/intelligence/services/calendar-season/seasonal-prompts';

export interface SeasonalContent {
  title: string;
  body: string;
  isSeasonallyEnhanced: boolean;
  holiday?: UpcomingHoliday;
}

/**
 * Get seasonally-enhanced battery check-in content
 */
export function getSeasonalBatteryCheckinContent(
  defaultTitle: string,
  defaultBody: string,
  now: Date = new Date()
): SeasonalContent {
  const holiday = getNextActionableHoliday({ now });
  const seasonalBody = getSeasonalBatteryPrompt(now);

  // If there's a holiday today or tomorrow, use special content
  if (holiday?.isToday) {
    return {
      title: `${holiday.holiday.name} check-in ✨`,
      body: seasonalBody,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  if (holiday?.isTomorrow || (holiday && holiday.daysUntil <= 3)) {
    return {
      title: defaultTitle,
      body: seasonalBody,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  // Use seasonal content randomly (30% of the time) to add variety
  if (Math.random() < 0.3) {
    return {
      title: defaultTitle,
      body: seasonalBody,
      isSeasonallyEnhanced: true,
    };
  }

  return {
    title: defaultTitle,
    body: defaultBody,
    isSeasonallyEnhanced: false,
  };
}

/**
 * Get seasonally-enhanced evening digest content
 */
export function getSeasonalEveningDigestContent(
  defaultTitle: string,
  defaultBody: string,
  now: Date = new Date()
): SeasonalContent {
  const holiday = getNextActionableHoliday({ now });
  const seasonalIntro = getSeasonalDigestIntro(now);

  if (holiday?.isToday) {
    return {
      title: `${holiday.holiday.name} evening brief ✨`,
      body: seasonalIntro,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  // During high-connection periods, enhance the content
  if (isHighConnectionPeriod(now)) {
    const { seasonEmoji } = getCurrentCalendarSeason(now);
    return {
      title: `Your evening brief ${seasonEmoji}`,
      body: seasonalIntro,
      isSeasonallyEnhanced: true,
    };
  }

  return {
    title: defaultTitle,
    body: defaultBody,
    isSeasonallyEnhanced: false,
  };
}

/**
 * Get seasonally-enhanced weekly reflection content
 */
export function getSeasonalWeeklyReflectionContent(
  defaultTitle: string,
  defaultBody: string,
  now: Date = new Date()
): SeasonalContent {
  const holiday = getNextActionableHoliday({ now });
  const prompts = getSeasonalReflectionPrompts(now);
  const { season, seasonEmoji } = getCurrentCalendarSeason(now);

  // Holiday-specific reflection
  if (holiday?.isToday || holiday?.isTomorrow) {
    return {
      title: `${holiday.holiday.name} reflection ${seasonEmoji}`,
      body: prompts[0] || defaultBody,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  // High-connection period enhancement
  if (isHighConnectionPeriod(now)) {
    return {
      title: `Time to reflect ${seasonEmoji}`,
      body: prompts[0] || defaultBody,
      isSeasonallyEnhanced: true,
    };
  }

  // Regular seasonal enhancement (50% of the time for variety)
  if (Math.random() < 0.5 && prompts.length > 0) {
    return {
      title: defaultTitle,
      body: prompts[Math.floor(Math.random() * prompts.length)],
      isSeasonallyEnhanced: true,
    };
  }

  return {
    title: defaultTitle,
    body: defaultBody,
    isSeasonallyEnhanced: false,
  };
}

/**
 * Get seasonally-enhanced smart suggestion content
 * This enhances the suggestion notification, not the suggestion itself
 */
export function getSeasonalSuggestionNotificationContent(
  suggestionTitle: string,
  suggestionSubtitle: string,
  now: Date = new Date()
): SeasonalContent {
  const holiday = getNextActionableHoliday({ now });

  // If there's a holiday coming up, add context
  if (holiday?.isToday) {
    return {
      title: `${holiday.holiday.name}: ${suggestionTitle}`,
      body: suggestionSubtitle,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  if (holiday?.isTomorrow) {
    return {
      title: suggestionTitle,
      body: `${holiday.holiday.name} tomorrow: ${suggestionSubtitle}`,
      isSeasonallyEnhanced: true,
      holiday,
    };
  }

  return {
    title: suggestionTitle,
    body: suggestionSubtitle,
    isSeasonallyEnhanced: false,
  };
}

/**
 * Get a special holiday notification if one should be sent today
 * Returns null if no special notification is warranted
 */
export function getHolidaySpecialNotification(
  now: Date = new Date()
): SeasonalContent | null {
  const holiday = getNextActionableHoliday({ now });

  if (!holiday?.isToday) return null;

  return {
    title: `Happy ${holiday.holiday.name}! 🎉`,
    body: holiday.holiday.connectionPrompt,
    isSeasonallyEnhanced: true,
    holiday,
  };
}

/**
 * Check if we should add seasonal context to any notification
 */
export function shouldAddSeasonalContext(now: Date = new Date()): boolean {
  const holiday = getNextActionableHoliday({ now });
  return holiday !== null || isHighConnectionPeriod(now);
}
