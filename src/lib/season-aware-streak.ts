/**
 * Season-Aware Streak System
 *
 * Compassionate streak tracking that respects the user's current social season:
 * - Resting (🌙): Hides all streak metrics
 * - Balanced (💧): Shows calm, encouraging messaging
 * - Blooming (🌱): Shows celebratory messaging
 *
 * Features:
 * - Streaks count: weaves, battery check-ins, and journal entries
 * - Forgiveness mechanic: "released" language instead of "broken"
 * - Clean slate when leaving resting season
 */

import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import { differenceInDays, startOfDay } from 'date-fns';
import Interaction from '../db/models/Interaction';
import WeeklyReflection from '../db/models/WeeklyReflection';
import UserProfile from '../db/models/UserProfile';
import UserProgress from '../db/models/UserProgress';
import { type SocialSeason } from '../db/models/UserProfile';

export interface StreakData {
  currentStreak: number;
  longestStreakEver: number;
  lastStreakCount: number;
  streakReleasedDate: Date | null;
  isVisible: boolean; // Based on season
  message: string;
  emoji: string;
  color: string; // For visual treatment
}

/**
 * Calculate current streak including all activity types
 */
export async function calculateCurrentStreak(
  profile: UserProfile | null
): Promise<number> {
  try {
    const today = startOfDay(new Date());
    const todayTimestamp = today.getTime();

    // Get all completed interactions
    const interactions = await database
      .get<Interaction>('interactions')
      .query(Q.where('status', 'completed'), Q.sortBy('interaction_date', Q.desc))
      .fetch();

    // Get battery check-ins
    const batteryHistory = profile?.socialBatteryHistory || [];

    // Get journal entries
    const journals = await database
      .get<WeeklyReflection>('weekly_reflections')
      .query(Q.sortBy('created_at', Q.desc))
      .fetch();

    // Build a set of unique activity dates
    const activityDates = new Set<string>();

    // Add interaction dates
    interactions.forEach(interaction => {
      const date = startOfDay(interaction.interactionDate);
      const dateKey = date.toISOString();
      activityDates.add(dateKey);
    });

    // Add battery check-in dates
    batteryHistory.forEach(entry => {
      const date = startOfDay(new Date(entry.timestamp));
      const dateKey = date.toISOString();
      activityDates.add(dateKey);
    });

    // Add journal entry dates
    journals.forEach(journal => {
      const date = startOfDay(journal.createdAt);
      const dateKey = date.toISOString();
      activityDates.add(dateKey);
    });

    // Convert to sorted array
    const sortedDates = Array.from(activityDates)
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime()); // Most recent first

    if (sortedDates.length === 0) return 0;

    // Calculate consecutive days from today backwards
    let streak = 0;
    let checkDate = today;

    for (const activityDate of sortedDates) {
      const daysDiff = differenceInDays(checkDate, activityDate);

      if (daysDiff === 0) {
        // Activity on this day
        streak++;
        // Move to previous day
        checkDate = new Date(checkDate);
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (daysDiff === 1) {
        // Gap of exactly 1 day - streak continues
        streak++;
        checkDate = new Date(checkDate);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Gap too large - streak broken
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Error calculating streak:', error);
    return 0;
  }
}

/**
 * Get season-aware streak data
 */
export async function getSeasonAwareStreakData(
  profile: UserProfile | null,
  userProgress: UserProgress | null
): Promise<StreakData> {
  const currentStreak = await calculateCurrentStreak(profile);
  const season = profile?.currentSocialSeason || 'balanced';

  // Resting season: hide completely
  if (season === 'resting') {
    return {
      currentStreak,
      longestStreakEver: userProgress?.longestStreakEver || 0,
      lastStreakCount: userProgress?.lastStreakCount || 0,
      streakReleasedDate: userProgress?.streakReleasedDate || null,
      isVisible: false,
      message: '',
      emoji: '',
      color: '',
    };
  }

  // Balanced season: calm messaging
  if (season === 'balanced') {
    const message = getBalancedMessage(currentStreak);
    return {
      currentStreak,
      longestStreakEver: userProgress?.longestStreakEver || 0,
      lastStreakCount: userProgress?.lastStreakCount || 0,
      streakReleasedDate: userProgress?.streakReleasedDate || null,
      isVisible: true,
      message,
      emoji: '💙',
      color: '#7DD3FC', // Softer sky blue
    };
  }

  // Blooming season: celebratory messaging
  const message = getBloomingMessage(currentStreak);
  return {
    currentStreak,
    longestStreakEver: userProgress?.longestStreakEver || 0,
    lastStreakCount: userProgress?.lastStreakCount || 0,
    streakReleasedDate: userProgress?.streakReleasedDate || null,
    isVisible: true,
    message,
    emoji: '💚✨',
    color: '#34D399', // Emerald green
  };
}

/**
 * Balanced season messaging (calm, encouraging)
 */
function getBalancedMessage(streak: number): string {
  if (streak === 0) return '';
  if (streak === 1) return "You're showing up today. Beautiful.";
  if (streak < 7) return `${streak}-day practice streak. You're in a beautiful flow.`;
  if (streak < 14) return `${streak} days of consistency. This is meaningful.`;
  if (streak < 30) return `${streak}-day practice streak. You're nurturing your connections beautifully.`;
  if (streak < 60) return `${streak} days strong. This rhythm is serving you.`;
  return `${streak}-day practice streak. You've built something remarkable.`;
}

/**
 * Blooming season messaging (celebratory)
 */
function getBloomingMessage(streak: number): string {
  if (streak === 0) return '';
  if (streak === 1) return "You're radiating connection today!";
  if (streak < 7) return `${streak}-day streak! Your connections are thriving.`;
  if (streak < 14) return `${streak}-day streak! You're a Connection Cultivator 🌱`;
  if (streak < 30) return `${streak}-day streak! You're a Thread Weaver 🏆`;
  if (streak < 60) return `${streak}-day streak! You're a Relationship Architect ✨`;
  return `${streak}-day streak! You're a Thread Master 🏆`;
}

/**
 * Get forgiveness message when streak is broken
 */
export function getForgiveness Message(lastStreakCount: number): string {
  if (lastStreakCount === 0) return '';
  if (lastStreakCount === 1) return 'You took a pause. That\'s okay—rhythms change.';
  if (lastStreakCount < 7) return `You released your ${lastStreakCount}-day streak. Some seasons need different rhythms. You can always begin a new one when you're ready.`;
  if (lastStreakCount < 30) return `You released your ${lastStreakCount}-day streak. Rest is part of the rhythm. Your weave remains strong.`;
  return `You released your ${lastStreakCount}-day streak. What a beautiful practice that was. When you're ready, you can begin again.`;
}

/**
 * Update streak when activity happens
 * Handles forgiveness mechanics and longest streak tracking
 */
export async function updateStreakAfterActivity(): Promise<void> {
  try {
    const profile = await database.get<UserProfile>('user_profile').query().fetch().then(p => p[0]);
    const userProgress = await database.get<UserProgress>('user_progress').query().fetch().then(p => p[0]);

    if (!userProgress) return;

    const currentStreak = await calculateCurrentStreak(profile);
    const previousStreak = userProgress.currentStreak;

    await database.write(async () => {
      await userProgress.update(progress => {
        // Streak is continuing or starting
        progress.currentStreak = currentStreak;

        // Update longest streak ever if needed
        if (currentStreak > progress.longestStreakEver) {
          progress.longestStreakEver = currentStreak;
        }

        // Update best streak (legacy field)
        if (currentStreak > progress.bestStreak) {
          progress.bestStreak = currentStreak;
        }

        // If streak broke (and it was non-zero), store forgiveness data
        if (previousStreak > 0 && currentStreak === 0) {
          progress.lastStreakCount = previousStreak;
          progress.streakReleasedDate = new Date();
        }

        progress.lastPracticeDate = new Date();
      });
    });
  } catch (error) {
    console.error('Error updating streak:', error);
  }
}

/**
 * Check if we should show forgiveness message
 * Only show for 7 days after streak was released
 */
export function shouldShowForgivenessMessage(
  streakData: StreakData,
  season: SocialSeason
): boolean {
  if (season === 'resting') return false; // Never show in resting
  if (!streakData.streakReleasedDate) return false;
  if (streakData.currentStreak > 0) return false; // Already back on track
  if (streakData.lastStreakCount === 0) return false;

  const daysSinceRelease = differenceInDays(new Date(), streakData.streakReleasedDate);
  return daysSinceRelease <= 7; // Show for one week
}
