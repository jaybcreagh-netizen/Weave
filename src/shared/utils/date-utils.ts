// shared/utils/date-utils.ts
import {
  isToday as dateFnsIsToday,
  differenceInDays,
  differenceInHours,
  format,
  startOfDay,
  endOfDay
} from 'date-fns';

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return dateFnsIsToday(date);
}

/**
 * Calculate days ago from a given date (always positive for past)
 */
export function daysAgo(date: Date): number {
  return Math.abs(differenceInDays(new Date(), date));
}

/**
 * Calculate days since with null handling
 * Returns Infinity if date is null
 */
export function daysSince(date: Date | null): number {
  if (!date) return Infinity;
  // Handle invalid dates
  if (isNaN(date.getTime())) return Infinity;

  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

/**
 * Calculate hours since a date
 */
export function hoursSince(date: Date): number {
  return differenceInHours(new Date(), date);
}

/**
 * Format date in Weave's standard format
 */
export function formatWeaveDate(date: Date): string {
  return format(date, 'MMM dd, yyyy');
}

/**
 * Get start of day for date calculations
 */
export function getStartOfDay(date?: Date): Date {
  return startOfDay(date || new Date());
}

/**
 * Get end of day for date calculations
 */
export function getEndOfDay(date?: Date): Date {
  return endOfDay(date || new Date());
}

/**
 * Flexible date parser that handles both "MM-DD" string format
 * and ISO 8601 date strings/Date objects.
 * Returns { month, day } or null if invalid.
 * Note: month is 1-indexed (1=January)
 */
export function parseFlexibleDate(value: string | Date | undefined | null): { month: number, day: number } | null {
  if (!value) return null;

  try {
    // Case 1: "MM-DD" string format (legacy)
    if (typeof value === 'string' && /^\d{1,2}-\d{1,2}$/.test(value)) {
      const [monthStr, dayStr] = value.split('-');
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { month, day };
      }
      return null;
    }

    // Case 2: ISO Date string or other parseable string
    const dateObj = typeof value === 'string' ? new Date(value) : value;

    // Check if valid date
    if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
      return {
        month: dateObj.getUTCMonth() + 1, // getUTCMonth is 0-indexed
        day: dateObj.getUTCDate()
      };
    }
  } catch (e) {
    // Ignore parsing errors and return null
    console.warn('Error parsing flexible date:', e);
  }

  return null;
}
