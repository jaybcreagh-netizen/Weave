import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { type InteractionCategory } from '@/components/types';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';

/**
 * Smart Defaults Engine
 *
 * Intelligently prioritizes interaction categories based on:
 * - Time of day (coffee at 9am, dinner at 7pm)
 * - Friend's archetype preferences
 * - Historical patterns with this friend
 *
 * Returns activities in priority order for frictionless UX
 */

export interface ActivityPriority {
  category: InteractionCategory;
  score: number;
  reasons: string[]; // Debug: why this scored high
}

/**
 * Check if smart defaults are enabled in settings
 */
export async function isSmartDefaultsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
    return value ? JSON.parse(value) : true; // Default to enabled
  } catch (error) {
    console.error('Error checking smart defaults setting:', error);
    return true; // Default to enabled on error
  }
}

/**
 * Time-based activity preferences
 * Higher score = more relevant for that time
 */
const TIME_PREFERENCES: Record<number, Partial<Record<InteractionCategory, number>>> = {
  // Early morning (6-9am)
  6: { 'text-call': 1.5, 'meal-drink': 2.0 }, // Morning coffee/breakfast
  7: { 'text-call': 1.5, 'meal-drink': 2.0 },
  8: { 'text-call': 1.5, 'meal-drink': 2.0, 'activity-hobby': 1.3 }, // Morning workout
  9: { 'text-call': 1.3, 'meal-drink': 1.8 },

  // Late morning (10-11am)
  10: { 'text-call': 1.3, 'meal-drink': 1.5 },
  11: { 'text-call': 1.2, 'meal-drink': 1.7 }, // Pre-lunch

  // Lunch (12-2pm)
  12: { 'meal-drink': 2.5, 'hangout': 1.3 },
  13: { 'meal-drink': 2.5, 'hangout': 1.3 },
  14: { 'meal-drink': 1.8, 'hangout': 1.2 },

  // Afternoon (3-5pm)
  15: { 'text-call': 1.3, 'hangout': 1.4, 'activity-hobby': 1.5 },
  16: { 'text-call': 1.2, 'hangout': 1.4, 'activity-hobby': 1.5 },
  17: { 'text-call': 1.2, 'meal-drink': 1.5, 'hangout': 1.3 }, // Early dinner

  // Evening (6-9pm)
  18: { 'meal-drink': 2.2, 'hangout': 1.6, 'event-party': 1.4 },
  19: { 'meal-drink': 2.5, 'hangout': 1.7, 'event-party': 1.5 },
  20: { 'meal-drink': 1.8, 'hangout': 1.5, 'event-party': 1.8 },
  21: { 'hangout': 1.4, 'event-party': 1.6, 'deep-talk': 1.3 },

  // Late night (10pm-midnight)
  22: { 'text-call': 1.8, 'deep-talk': 1.5, 'voice-note': 1.4 },
  23: { 'text-call': 2.0, 'deep-talk': 1.3, 'voice-note': 1.5 },
};

/**
 * Day of week preferences
 * Weekends favor different activities than weekdays
 */
function getDayOfWeekMultiplier(category: InteractionCategory, dayOfWeek: number): number {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend) {
    // Weekends: favor activities, events, longer hangouts
    if (category === 'activity-hobby') return 1.3;
    if (category === 'event-party') return 1.4;
    if (category === 'meal-drink') return 1.2;
  } else {
    // Weekdays: favor quick connections
    if (category === 'text-call') return 1.2;
    if (category === 'voice-note') return 1.2;
  }

  return 1.0; // Neutral
}

/**
 * Archetype preferences
 * Each archetype has natural affinity for certain activities
 */
function getArchetypeScore(category: InteractionCategory, archetype: string): number {
  const preferred = getArchetypePreferredCategory(archetype as any);

  // High bonus for archetype's preferred category
  if (category === preferred) return 1.8;

  // Archetype-specific secondary preferences
  const secondaryPreferences: Record<string, Partial<Record<InteractionCategory, number>>> = {
    'The High Priestess': { 'deep-talk': 1.8, 'text-call': 1.3, 'hangout': 1.2 },
    'The Adventurer': { 'activity-hobby': 1.8, 'event-party': 1.4, 'hangout': 1.3 },
    'The Sun': { 'event-party': 1.8, 'celebration': 1.6, 'meal-drink': 1.3 },
    'The Hermit': { 'deep-talk': 1.8, 'text-call': 1.4, 'hangout': 1.2 },
    'The Magician': { 'activity-hobby': 1.8, 'deep-talk': 1.3, 'hangout': 1.2 },
    'The Empress': { 'meal-drink': 1.8, 'hangout': 1.4, 'favor-support': 1.3 },
    'The Emperor': { 'hangout': 1.8, 'activity-hobby': 1.3, 'meal-drink': 1.2 },
  };

  return secondaryPreferences[archetype]?.[category] || 1.0;
}

/**
 * Calculate historical pattern score
 * What you usually do with this friend
 */
async function getHistoricalScore(
  category: InteractionCategory,
  friend: FriendModel
): Promise<number> {
  try {
    // Get last 60 days of interactions
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const allInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(sixtyDaysAgo)),
        Q.sortBy('interaction_date', Q.desc)
      )
      .fetch();

    // Filter to this friend's interactions
    const friendInteractions: Interaction[] = [];
    for (const interaction of allInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some((jf: any) => jf.friendId === friend.id)) {
        friendInteractions.push(interaction);
      }
    }

    if (friendInteractions.length === 0) return 1.0;

    // Count occurrences of this category
    const categoryCount = friendInteractions.filter(
      i => i.interactionCategory === category
    ).length;

    // If this is your most common activity with this friend, boost it
    const mostCommonCount = Math.max(
      ...Object.values(
        friendInteractions.reduce((acc, i) => {
          const cat = i.interactionCategory || 'unknown';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
    );

    if (categoryCount === mostCommonCount && categoryCount >= 2) {
      return 1.5; // Strong pattern bonus
    }

    if (categoryCount >= 2) {
      return 1.2; // Moderate pattern bonus
    }

    return 1.0; // No pattern
  } catch (error) {
    console.error('Error calculating historical score:', error);
    return 1.0;
  }
}

/**
 * Main function: Calculate priority scores for all activities
 */
export async function calculateActivityPriorities(
  friend: FriendModel,
  currentTime: Date = new Date()
): Promise<ActivityPriority[]> {
  const hour = currentTime.getHours();
  const dayOfWeek = currentTime.getDay();

  // All available categories
  const categories: InteractionCategory[] = [
    'text-call',
    'meal-drink',
    'hangout',
    'deep-talk',
    'activity-hobby',
    'voice-note',
    'event-party',
    'favor-support',
    'celebration',
  ];

  // Calculate scores for each category
  const priorities: ActivityPriority[] = await Promise.all(
    categories.map(async category => {
      const reasons: string[] = [];
      let score = 1.0; // Base score

      // Time of day multiplier
      const timeScore = TIME_PREFERENCES[hour]?.[category] || 1.0;
      if (timeScore > 1.0) {
        score *= timeScore;
        reasons.push(`time:${timeScore.toFixed(1)}`);
      }

      // Day of week multiplier
      const dayScore = getDayOfWeekMultiplier(category, dayOfWeek);
      if (dayScore > 1.0) {
        score *= dayScore;
        reasons.push(`day:${dayScore.toFixed(1)}`);
      }

      // Archetype affinity
      const archetypeScore = getArchetypeScore(category, friend.archetype);
      if (archetypeScore > 1.0) {
        score *= archetypeScore;
        reasons.push(`archetype:${archetypeScore.toFixed(1)}`);
      }

      // Historical pattern
      const historyScore = await getHistoricalScore(category, friend);
      if (historyScore > 1.0) {
        score *= historyScore;
        reasons.push(`history:${historyScore.toFixed(1)}`);
      }

      return {
        category,
        score,
        reasons,
      };
    })
  );

  // Sort by score descending
  return priorities.sort((a, b) => b.score - a.score);
}

/**
 * Get top N activities for quick access (e.g., radial menu)
 */
export async function getTopActivities(
  friend: FriendModel,
  count: number = 6,
  currentTime: Date = new Date()
): Promise<InteractionCategory[]> {
  const priorities = await calculateActivityPriorities(friend, currentTime);
  return priorities.slice(0, count).map(p => p.category);
}

/**
 * Get the single most recommended activity
 */
export async function getTopActivity(
  friend: FriendModel,
  currentTime: Date = new Date()
): Promise<{ category: InteractionCategory; confidence: 'high' | 'medium' | 'low' }> {
  const priorities = await calculateActivityPriorities(friend, currentTime);
  const top = priorities[0];

  // Determine confidence based on score
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (top.score >= 2.5) confidence = 'high';
  else if (top.score >= 1.8) confidence = 'medium';

  return {
    category: top.category,
    confidence,
  };
}

/**
 * Default times for each category (24-hour format)
 * Based on typical social patterns
 */
const CATEGORY_DEFAULT_TIMES: Record<InteractionCategory, { hour: number; minute: number }> = {
  'text-call': { hour: 10, minute: 0 },      // Mid-morning check-in
  'voice-note': { hour: 20, minute: 0 },     // Evening, time to listen
  'meal-drink': { hour: 19, minute: 0 },     // Default to dinner (context-aware below)
  'hangout': { hour: 15, minute: 0 },        // Afternoon hangout
  'deep-talk': { hour: 10, minute: 30 },     // Late morning, focused time
  'event-party': { hour: 19, minute: 0 },    // Evening start
  'activity-hobby': { hour: 14, minute: 0 }, // Afternoon, good energy
  'favor-support': { hour: 11, minute: 0 },  // Mid-morning, practical help
  'celebration': { hour: 18, minute: 0 },    // Early evening for special occasions
};

/**
 * Helper to set time on a date object
 */
function setTimeOnDate(date: Date, hour: number, minute: number = 0): Date {
  const newDate = new Date(date);
  newDate.setHours(hour, minute, 0, 0);
  return newDate;
}

/**
 * Get context-aware default time for meal-drink category
 * Suggests coffee, lunch, or dinner based on current time
 */
function getMealDrinkDefaultTime(planDate: Date, currentTime: Date = new Date()): Date {
  const currentHour = currentTime.getHours();

  // If planning for a different day, use time of day on that day to determine meal
  const referenceHour = planDate.toDateString() === currentTime.toDateString()
    ? currentHour
    : planDate.getHours();

  // Morning (before 10am): suggest coffee at 9am
  if (referenceHour < 10) {
    return setTimeOnDate(planDate, 9, 0);
  }

  // Midday (10am-3pm): suggest lunch at 12:30pm
  if (referenceHour < 15) {
    return setTimeOnDate(planDate, 12, 30);
  }

  // Afternoon/Evening (3pm+): suggest dinner at 7pm
  return setTimeOnDate(planDate, 19, 0);
}

/**
 * Get smart default time for a given category
 * Returns a date object with the suggested time set
 */
export function getDefaultTimeForCategory(
  category: InteractionCategory,
  planDate: Date,
  currentTime: Date = new Date()
): Date {
  // Special case: meal-drink is context-aware
  if (category === 'meal-drink') {
    return getMealDrinkDefaultTime(planDate, currentTime);
  }

  // All other categories use fixed defaults
  const defaultTime = CATEGORY_DEFAULT_TIMES[category];
  return setTimeOnDate(planDate, defaultTime.hour, defaultTime.minute);
}
