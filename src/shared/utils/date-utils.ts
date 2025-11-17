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
