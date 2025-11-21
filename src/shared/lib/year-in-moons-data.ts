/**
 * Year in Moons Data Layer
 * Fetches battery check-ins from UserProfile and maps them to moon phases for calendar visualization
 */

import { database } from '@/db';
import UserProfile, { BatteryHistoryEntry } from '@/db/models/UserProfile';

export interface DayMoonData {
  date: Date;
  batteryLevel: number | null; // 1-5 or null if no check-in
  moonPhase: number; // 0-1 (0 = new moon, 1 = full moon)
  hasCheckin: boolean;
}

export interface MonthMoonData {
  month: number; // 0-11
  year: number;
  days: DayMoonData[];
}

/**
 * Convert battery level (1-5) to moon phase illumination (0-1)
 */
export function batteryToMoonPhase(batteryLevel: number | null): number {
  if (batteryLevel === null) return 0.1; // Barely visible new moon for unchecked days

  const phaseMap: Record<number, number> = {
    1: 0.0,   // New moon (depleted)
    2: 0.25,  // Waxing crescent
    3: 0.5,   // First quarter
    4: 0.75,  // Waxing gibbous
    5: 1.0,   // Full moon (energized)
  };

  return phaseMap[batteryLevel] ?? 0.1;
}

/**
 * Fetch battery history from UserProfile
 */
async function fetchBatteryHistory(): Promise<BatteryHistoryEntry[]> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();

    if (profiles.length === 0) {
      return [];
    }

    const profile = profiles[0];
    return profile.socialBatteryHistory || [];
  } catch (error) {
    console.error('Error fetching battery history:', error);
    return [];
  }
}

/**
 * Get the most recent battery check-in for a specific date
 */
function getBatteryForDate(history: BatteryHistoryEntry[], targetDate: Date): number | null {
  // Find check-ins on this date
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const dayCheckins = history.filter((entry) => {
    return entry.timestamp >= dayStart.getTime() && entry.timestamp <= dayEnd.getTime();
  });

  // Return the most recent check-in's battery level
  if (dayCheckins.length > 0) {
    // Sort by timestamp and get most recent
    const sorted = dayCheckins.sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0].value;
  }

  return null;
}

/**
 * Generate moon data for all days in a specific month
 */
async function getMonthMoonData(
  year: number,
  month: number,
  batteryHistory: BatteryHistoryEntry[]
): Promise<MonthMoonData> {
  // Get number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: DayMoonData[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const batteryLevel = getBatteryForDate(batteryHistory, date);
    const moonPhase = batteryToMoonPhase(batteryLevel);

    days.push({
      date,
      batteryLevel,
      moonPhase,
      hasCheckin: batteryLevel !== null,
    });
  }

  return {
    month,
    year,
    days,
  };
}

/**
 * Generate moon data for an entire year
 */
export async function getYearMoonData(year: number): Promise<MonthMoonData[]> {
  const batteryHistory = await fetchBatteryHistory();
  const months: MonthMoonData[] = [];

  for (let month = 0; month < 12; month++) {
    const monthData = await getMonthMoonData(year, month, batteryHistory);
    months.push(monthData);
  }

  return months;
}

/**
 * Get stats for the year (for summary display)
 */
export async function getYearStats(year: number): Promise<{
  totalCheckins: number;
  avgBattery: number;
  mostCommonLevel: number;
  streakDays: number;
}> {
  const batteryHistory = await fetchBatteryHistory();

  // Filter to only entries in the target year
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

  const yearHistory = batteryHistory.filter(
    (entry) => entry.timestamp >= yearStart && entry.timestamp <= yearEnd
  );

  if (yearHistory.length === 0) {
    return {
      totalCheckins: 0,
      avgBattery: 0,
      mostCommonLevel: 0,
      streakDays: 0,
    };
  }

  // Calculate average battery
  const totalBattery = yearHistory.reduce((sum, entry) => sum + entry.value, 0);
  const avgBattery = Math.round(totalBattery / yearHistory.length);

  // Find most common battery level
  const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  yearHistory.forEach((entry) => {
    levelCounts[entry.value] = (levelCounts[entry.value] || 0) + 1;
  });

  const mostCommonLevel = Object.entries(levelCounts).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0];

  // Calculate current streak (consecutive days with check-ins from today backwards)
  const now = new Date();
  let streakDays = 0;
  const checkDate = new Date(now); // Use const here and only modify via setDate
  checkDate.setHours(0, 0, 0, 0);

  while (streakDays < 365) {
    const hasCheckin = getBatteryForDate(batteryHistory, checkDate) !== null;
    if (!hasCheckin) break;

    streakDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalCheckins: yearHistory.length,
    avgBattery,
    mostCommonLevel: parseInt(mostCommonLevel),
    streakDays,
  };
}

/**
 * Get month name from month index (0-11)
 */
export function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month];
}
