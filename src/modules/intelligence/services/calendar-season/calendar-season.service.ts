/**
 * Calendar Season Service
 *
 * Detects upcoming holidays and calendar-based seasons
 * to provide contextual suggestions and prompts.
 */

import { differenceInDays, startOfDay, getMonth, getDate } from 'date-fns';
import {
  Holiday,
  HolidayRegion,
  HOLIDAYS,
  DYNAMIC_DATE_CALCULATORS,
  getHolidaysForRegion,
} from './holidays';
import Logger from '@/shared/utils/Logger';

export type CalendarSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export interface UpcomingHoliday {
  holiday: Holiday;
  date: Date;
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
  isWithinLeadTime: boolean;
}

export interface CalendarSeasonInfo {
  season: CalendarSeason;
  seasonEmoji: string;
  seasonPrompt: string;
}

/**
 * Get the actual date for a holiday in a given year
 */
function getHolidayDate(holiday: Holiday, year: number): Date {
  if (holiday.date === 'dynamic' && holiday.dynamicDateKey) {
    const calculator = DYNAMIC_DATE_CALCULATORS[holiday.dynamicDateKey];
    if (calculator) {
      return calculator(year);
    }
    Logger.warn(`[CalendarSeason] No calculator for dynamic holiday: ${holiday.id}`);
    return new Date(year, 0, 1); // Fallback to Jan 1
  }

  // Parse MM-DD format
  const [month, day] = holiday.date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get upcoming holidays within a certain window
 */
export function getUpcomingHolidays(
  options: {
    now?: Date;
    region?: HolidayRegion;
    enabledHolidayIds?: string[];
    maxDaysAhead?: number;
  } = {}
): UpcomingHoliday[] {
  const {
    now = new Date(),
    region = 'global',
    enabledHolidayIds,
    maxDaysAhead = 30,
  } = options;

  const today = startOfDay(now);
  const currentYear = today.getFullYear();

  // Get holidays for the region
  let holidays = getHolidaysForRegion(region);

  // Filter by enabled IDs if provided
  if (enabledHolidayIds) {
    holidays = holidays.filter(h => enabledHolidayIds.includes(h.id));
  }

  const upcoming: UpcomingHoliday[] = [];

  for (const holiday of holidays) {
    // Check this year and next year (for holidays early in the year)
    for (const year of [currentYear, currentYear + 1]) {
      const holidayDate = startOfDay(getHolidayDate(holiday, year));
      const daysUntil = differenceInDays(holidayDate, today);

      // Skip if in the past or too far ahead
      if (daysUntil < 0 || daysUntil > maxDaysAhead) continue;

      upcoming.push({
        holiday,
        date: holidayDate,
        daysUntil,
        isToday: daysUntil === 0,
        isTomorrow: daysUntil === 1,
        isWithinLeadTime: daysUntil <= holiday.leadTimeDays,
      });

      // Only take the first occurrence (this year or next)
      break;
    }
  }

  // Sort by days until
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Get the next upcoming holiday that's within its lead time
 */
export function getNextActionableHoliday(
  options: {
    now?: Date;
    region?: HolidayRegion;
    enabledHolidayIds?: string[];
  } = {}
): UpcomingHoliday | null {
  const upcoming = getUpcomingHolidays({
    ...options,
    maxDaysAhead: 30, // Look ahead a month
  });

  // Find the first holiday within its lead time
  return upcoming.find(h => h.isWithinLeadTime) || null;
}

/**
 * Check if a specific holiday is upcoming
 */
export function isHolidayUpcoming(
  holidayId: string,
  options: { now?: Date } = {}
): UpcomingHoliday | null {
  const now = options.now || new Date();
  const holiday = HOLIDAYS.find(h => h.id === holidayId);

  if (!holiday) return null;

  const upcoming = getUpcomingHolidays({
    now,
    enabledHolidayIds: [holidayId],
    maxDaysAhead: holiday.leadTimeDays,
  });

  return upcoming[0] || null;
}

/**
 * Get the current calendar season based on date
 * Northern hemisphere seasons (can be extended for southern)
 */
export function getCurrentCalendarSeason(now: Date = new Date()): CalendarSeasonInfo {
  const month = getMonth(now); // 0-indexed
  const day = getDate(now);

  // Approximate season boundaries (Northern Hemisphere)
  // Winter: Dec 21 - Mar 19
  // Spring: Mar 20 - Jun 20
  // Summer: Jun 21 - Sep 21
  // Autumn: Sep 22 - Dec 20

  let season: CalendarSeason;

  if ((month === 11 && day >= 21) || month <= 1 || (month === 2 && day <= 19)) {
    season = 'winter';
  } else if ((month === 2 && day >= 20) || month <= 4 || (month === 5 && day <= 20)) {
    season = 'spring';
  } else if ((month === 5 && day >= 21) || month <= 7 || (month === 8 && day <= 21)) {
    season = 'summer';
  } else {
    season = 'autumn';
  }

  const seasonData: Record<CalendarSeason, { emoji: string; prompt: string }> = {
    winter: {
      emoji: '❄️',
      prompt: "Winter invites cozy, intentional connection. Quality over quantity.",
    },
    spring: {
      emoji: '🌸',
      prompt: "Spring energy awakens—a perfect time to reconnect and let friendships bloom.",
    },
    summer: {
      emoji: '☀️',
      prompt: "Long summer days offer space for spontaneous connection and adventure.",
    },
    autumn: {
      emoji: '🍂',
      prompt: "As autumn settles, we naturally draw closer to those who matter most.",
    },
  };

  return {
    season,
    seasonEmoji: seasonData[season].emoji,
    seasonPrompt: seasonData[season].prompt,
  };
}

/**
 * Get seasonal greeting enhancement based on current time of year
 * Can be combined with social season greetings
 */
export function getSeasonalGreetingEnhancement(now: Date = new Date()): string | null {
  const nextHoliday = getNextActionableHoliday({ now });

  if (nextHoliday?.isToday) {
    return `Happy ${nextHoliday.holiday.name}! ${nextHoliday.holiday.shortPrompt}`;
  }

  if (nextHoliday?.isTomorrow) {
    return `${nextHoliday.holiday.name} is tomorrow. ${nextHoliday.holiday.shortPrompt}`;
  }

  if (nextHoliday?.isWithinLeadTime && nextHoliday.daysUntil <= 3) {
    return `${nextHoliday.holiday.name} is in ${nextHoliday.daysUntil} days.`;
  }

  return null;
}

/**
 * Determine if we're in a "high connection" time of year
 * (holidays cluster, people naturally connect more)
 */
export function isHighConnectionPeriod(now: Date = new Date()): boolean {
  const month = getMonth(now);
  const day = getDate(now);

  // Late November through early January (holiday season)
  if (month === 10 && day >= 20) return true; // Late Nov
  if (month === 11) return true; // December
  if (month === 0 && day <= 7) return true; // Early Jan

  // Valentine's season
  if (month === 1 && day >= 7 && day <= 14) return true;

  return false;
}

/**
 * Get all holidays happening today (for special treatment)
 */
export function getHolidaysToday(
  options: { now?: Date; region?: HolidayRegion; enabledHolidayIds?: string[] } = {}
): UpcomingHoliday[] {
  return getUpcomingHolidays({ ...options, maxDaysAhead: 0 }).filter(h => h.isToday);
}
