// src/modules/relationships/services/weekly-reflection.service.ts
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
