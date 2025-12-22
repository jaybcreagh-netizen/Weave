
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import type WeeklyReflection from '@/db/models/WeeklyReflection';

export function isCurrentWeek(weeklyReflection: WeeklyReflection): boolean {
  const now = Date.now();
  return now >= weeklyReflection.weekStartDate && now <= weeklyReflection.weekEndDate;
}

export function getWeekRange(weeklyReflection: WeeklyReflection): string {
  const start = new Date(weeklyReflection.weekStartDate);
  const end = new Date(weeklyReflection.weekEndDate);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Get the start and end of the week being reflected on (Sunday to Saturday).
 * If today is Sunday or Monday, we assume the user is reflecting on the PREVIOUS week
 * (the one that ended on Saturday). This gives a 2-day grace period to complete reflections.
 */
export function getCurrentWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday

  // If it's Sunday (0) or Monday (1), assume we are reflecting on the PREVIOUS week.
  // Sunday: previous week ended yesterday (Saturday)
  // Monday: previous week ended 2 days ago (Saturday)
  // Otherwise, we look at the current week (starting last Sunday).
  const adjustDays = (dayOfWeek === 0 || dayOfWeek === 1) ? 7 : 0;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek - adjustDays);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Check if a reflection has already been completed for the current target week
 */
export async function hasCompletedReflectionForCurrentWeek(): Promise<boolean> {
  const { weekStart } = getCurrentWeekBounds();

  const count = await database
    .get<WeeklyReflection>('weekly_reflections')
    .query(
      Q.where('week_start_date', weekStart.getTime())
    )
    .fetchCount();

  return count > 0;
}
