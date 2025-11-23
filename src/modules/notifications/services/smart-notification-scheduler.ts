/**
 * Smart Notification Scheduler
 * Intelligently decides WHEN and WHAT to notify users about
 * Integrates: Social Battery, Suggestion Engine, Portfolio Insights, Time-of-Day
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../db';
import UserProfile from '../db/models/UserProfile';
import Friend from '../db/models/Friend';
import { Suggestion } from '../types/suggestions';
import { generateSuggestion } from './suggestion-engine';
import { calculateCurrentScore } from '@/modules/intelligence';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';

// AsyncStorage keys
const LAST_SMART_NOTIFICATION_KEY = '@weave:last_smart_notification';
const SMART_NOTIFICATION_COUNT_KEY = '@weave:smart_notification_count';
const SCHEDULED_SMART_NOTIFICATIONS_KEY = '@weave:scheduled_smart_notifications';

// Minimum hours between smart notifications (prevents immediate spam)
const MIN_HOURS_BETWEEN_NOTIFICATIONS = 2;

// Notification preferences (will be moved to user settings)
export interface NotificationPreferences {
  frequency: 'light' | 'moderate' | 'proactive'; // How often to notify
  quietHoursStart: number; // Hour (0-23) when quiet hours start (e.g., 22 for 10 PM)
  quietHoursEnd: number; // Hour (0-23) when quiet hours end (e.g., 8 for 8 AM)
  respectBattery: boolean; // Whether to reduce notifications when battery is low
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  frequency: 'moderate',
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8, // 8 AM
  respectBattery: true,
};

/**
 * Get user's notification preferences
 */
async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem('@weave:notification_preferences');
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading notification preferences:', error);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(prefs: NotificationPreferences): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  // Handle cases where quiet hours span midnight
  if (prefs.quietHoursStart > prefs.quietHoursEnd) {
    return currentHour >= prefs.quietHoursStart || currentHour < prefs.quietHoursEnd;
  }

  return currentHour >= prefs.quietHoursStart && currentHour < prefs.quietHoursEnd;
}

/**
 * Get user's current social battery level
 */
async function getSocialBatteryLevel(): Promise<number | null> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();
    if (profiles.length === 0) return null;

    const profile = profiles[0];
    return profile.socialBatteryCurrent;
  } catch (error) {
    console.error('Error getting social battery:', error);
    return null;
  }
}

/**
 * Get how many smart notifications were sent today
 */
async function getTodayNotificationCount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(SMART_NOTIFICATION_COUNT_KEY);
    if (!stored) return 0;

    const { date, count } = JSON.parse(stored);
    const today = new Date().toDateString();

    if (date === today) {
      return count;
    }

    // Reset count for new day
    return 0;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
}

/**
 * Increment today's notification count
 */
async function incrementNotificationCount(): Promise<void> {
  try {
    const today = new Date().toDateString();
    const currentCount = await getTodayNotificationCount();

    await AsyncStorage.setItem(
      SMART_NOTIFICATION_COUNT_KEY,
      JSON.stringify({ date: today, count: currentCount + 1 })
    );
  } catch (error) {
    console.error('Error incrementing notification count:', error);
  }
}

/**
 * Get the last time a smart notification was scheduled
 */
async function getLastNotificationTime(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SMART_NOTIFICATION_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.error('Error getting last notification time:', error);
    return null;
  }
}

/**
 * Update the last notification time
 */
async function updateLastNotificationTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SMART_NOTIFICATION_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error updating last notification time:', error);
  }
}

/**
 * Check if enough time has passed since last notification
 */
async function hasMinimumCooldownPassed(): Promise<boolean> {
  const lastTime = await getLastNotificationTime();
  if (!lastTime) return true; // No previous notification, ok to send

  const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
  return hoursSince >= MIN_HOURS_BETWEEN_NOTIFICATIONS;
}

/**
 * Get list of already scheduled smart notification IDs for today
 */
async function getScheduledNotifications(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_SMART_NOTIFICATIONS_KEY);
    if (!stored) return [];

    const { date, ids } = JSON.parse(stored);
    const today = new Date().toDateString();

    if (date === today) {
      return ids;
    }

    // Reset for new day
    return [];
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Add a notification ID to the scheduled list
 */
async function addScheduledNotification(notificationId: string): Promise<void> {
  try {
    const today = new Date().toDateString();
    const current = await getScheduledNotifications();
    current.push(notificationId);

    await AsyncStorage.setItem(
      SCHEDULED_SMART_NOTIFICATIONS_KEY,
      JSON.stringify({ date: today, ids: current })
    );
  } catch (error) {
    console.error('Error adding scheduled notification:', error);
  }
}

/**
 * Check if we can send another notification based on daily limits
 */
async function canSendNotification(
  prefs: NotificationPreferences,
  urgency: Suggestion['urgency']
): Promise<boolean> {
  const todayCount = await getTodayNotificationCount();

  // Critical notifications always send (up to 3 per day to avoid spam)
  if (urgency === 'critical') {
    return todayCount < 3;
  }

  // Frequency-based limits
  const limits = {
    light: 1, // Max 1 non-critical notification per day
    moderate: 2, // Max 2 non-critical notifications per day
    proactive: 4, // Max 4 non-critical notifications per day
  };

  return todayCount < limits[prefs.frequency];
}

/**
 * Determine if notification should be sent based on battery level
 */
function shouldRespectBattery(
  batteryLevel: number | null,
  urgency: Suggestion['urgency'],
  prefs: NotificationPreferences
): boolean {
  // Always send critical notifications regardless of battery
  if (urgency === 'critical') return true;

  // If user doesn't want to respect battery, always send
  if (!prefs.respectBattery) return true;

  // If battery is unknown, err on the side of caution (don't send medium/low priority)
  if (batteryLevel === null) {
    return urgency === 'high';
  }

  // Battery-based thresholds
  if (batteryLevel < 30) {
    // Very low battery - only high urgency
    return urgency === 'high';
  }

  if (batteryLevel < 50) {
    // Low battery - high and medium
    return urgency === 'high' || urgency === 'medium';
  }

  // Battery is fine, send all
  return true;
}

/**
 * Generate all available suggestions for smart notifications
 */
async function generateSmartSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  try {
    const friends = await database.get<Friend>('friends').query().fetch();

    for (const friend of friends) {
      // Query friend's interactions through the junction table
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();

      const interactionIds = interactionFriends.map((ifriend) => ifriend.interactionId);

      let sortedInteractions: Interaction[] = [];
      if (interactionIds.length > 0) {
        const friendInteractions = await database
          .get<Interaction>('interactions')
          .query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed')
          )
          .fetch();

        sortedInteractions = friendInteractions.sort(
          (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
        );
      }

      const lastInteraction = sortedInteractions[0];
      const currentScore = calculateCurrentScore(friend);

      // Calculate current momentum score
      const daysSinceMomentumUpdate =
        (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
      const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

      const suggestion = await generateSuggestion({
        friend: {
          id: friend.id,
          name: friend.name,
          archetype: friend.archetype,
          dunbarTier: friend.dunbarTier,
          createdAt: friend.createdAt,
          birthday: friend.birthday,
          anniversary: friend.anniversary,
          relationshipType: friend.relationshipType,
        },
        currentScore,
        lastInteractionDate: lastInteraction?.interactionDate,
        interactionCount: sortedInteractions.length,
        momentumScore,
        recentInteractions: sortedInteractions.slice(0, 5).map((i) => ({
          id: i.id,
          category: i.interactionCategory as any,
          interactionDate: i.interactionDate,
          vibe: i.vibe,
          notes: i.note,
        })),
      });

      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  } catch (error) {
    console.error('Error generating smart suggestions:', error);
  }

  return suggestions;
}

/**
 * Schedule a smart notification based on a suggestion
 */
async function scheduleSuggestionNotification(
  suggestion: Suggestion,
  delayMinutes: number = 0
): Promise<void> {
  const trigger = delayMinutes > 0
    ? new Date(Date.now() + delayMinutes * 60 * 1000)
    : null; // null = immediate

  const notificationId = `smart-suggestion-${suggestion.id}`;

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: suggestion.title,
      body: suggestion.subtitle,
      data: {
        type: 'friend-suggestion',
        friendId: suggestion.friendId,
        friendName: suggestion.friendName,
        suggestionId: suggestion.id,
      },
    },
    trigger,
  });

  console.log(`[Smart Notifications] Scheduled: ${suggestion.title} (delay: ${delayMinutes}m)`);
}

/**
 * Calculate delay times to spread notifications throughout the day
 * Returns delays in minutes for each notification
 */
function calculateSpreadDelays(count: number, prefs: NotificationPreferences): number[] {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Define time slots throughout the day (in hours from now)
  const timeSlots: number[] = [];

  // Morning slot (9-11 AM)
  if (currentHour < 9) {
    timeSlots.push(9 - currentHour);
  }

  // Midday slot (12-2 PM)
  if (currentHour < 12) {
    const hoursUntil = 12 - currentHour;
    if (hoursUntil >= MIN_HOURS_BETWEEN_NOTIFICATIONS) {
      timeSlots.push(hoursUntil);
    }
  }

  // Afternoon slot (3-5 PM)
  if (currentHour < 15) {
    const hoursUntil = 15 - currentHour;
    if (hoursUntil >= MIN_HOURS_BETWEEN_NOTIFICATIONS) {
      timeSlots.push(hoursUntil);
    }
  }

  // Evening slot (6-8 PM, before quiet hours)
  if (currentHour < 18 && prefs.quietHoursStart > 18) {
    const hoursUntil = 18 - currentHour;
    if (hoursUntil >= MIN_HOURS_BETWEEN_NOTIFICATIONS) {
      timeSlots.push(hoursUntil);
    }
  }

  // If no future slots today, schedule throughout remaining hours
  if (timeSlots.length === 0) {
    const hoursUntilQuiet = prefs.quietHoursStart - currentHour;
    if (hoursUntilQuiet > MIN_HOURS_BETWEEN_NOTIFICATIONS) {
      // Spread across remaining hours
      for (let i = 1; i <= count && i * MIN_HOURS_BETWEEN_NOTIFICATIONS < hoursUntilQuiet; i++) {
        timeSlots.push(i * MIN_HOURS_BETWEEN_NOTIFICATIONS);
      }
    }
  }

  // Convert hours to minutes and add some randomness (±15 min) for natural feel
  const delays = timeSlots.slice(0, count).map(hours => {
    const baseMinutes = hours * 60 - currentMinute;
    const randomOffset = Math.floor(Math.random() * 30) - 15; // ±15 min
    return Math.max(MIN_HOURS_BETWEEN_NOTIFICATIONS * 60, baseMinutes + randomOffset);
  });

  return delays;
}

/**
 * Main intelligent notification decision engine
 * Schedules notifications spread throughout the day to avoid spam
 */
export async function evaluateAndScheduleSmartNotifications(): Promise<void> {
  console.log('[Smart Notifications] Evaluating what to send...');

  // Check if minimum cooldown has passed
  const cooldownPassed = await hasMinimumCooldownPassed();
  if (!cooldownPassed) {
    console.log('[Smart Notifications] Cooldown period active, skipping');
    return;
  }

  // Load preferences
  const prefs = await getNotificationPreferences();

  // Check quiet hours
  if (isQuietHours(prefs)) {
    console.log('[Smart Notifications] Currently in quiet hours, skipping');
    return;
  }

  // Check if we already have notifications scheduled for today
  const alreadyScheduled = await getScheduledNotifications();
  const todayCount = await getTodayNotificationCount();

  // Frequency-based limits
  const limits = {
    light: 1,
    moderate: 2,
    proactive: 4,
  };

  const maxAllowed = limits[prefs.frequency];
  const remainingSlots = maxAllowed - alreadyScheduled.length;

  if (remainingSlots <= 0) {
    console.log('[Smart Notifications] All notification slots filled for today');
    return;
  }

  // Get social battery level
  const batteryLevel = await getSocialBatteryLevel();
  console.log(`[Smart Notifications] Battery level: ${batteryLevel ?? 'unknown'}`);

  // Generate suggestions
  const suggestions = await generateSmartSuggestions();
  console.log(`[Smart Notifications] Generated ${suggestions.length} suggestions`);

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = suggestions.sort(
    (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  );

  // Filter suggestions that pass battery check
  const eligible: Suggestion[] = [];
  for (const suggestion of sorted) {
    const batteryAllows = shouldRespectBattery(batteryLevel, suggestion.urgency, prefs);
    if (batteryAllows) {
      eligible.push(suggestion);
    }
  }

  if (eligible.length === 0) {
    console.log('[Smart Notifications] No eligible suggestions to send');
    return;
  }

  // Select top suggestions up to remaining slots
  const toSchedule = eligible.slice(0, remainingSlots);

  // Calculate delays to spread throughout the day
  const delays = calculateSpreadDelays(toSchedule.length, prefs);

  // Schedule each notification with appropriate delay
  for (let i = 0; i < toSchedule.length; i++) {
    const suggestion = toSchedule[i];
    const delayMinutes = delays[i] || (i + 1) * MIN_HOURS_BETWEEN_NOTIFICATIONS * 60;

    await scheduleSuggestionNotification(suggestion, delayMinutes);
    await incrementNotificationCount();
    await addScheduledNotification(`smart-suggestion-${suggestion.id}`);

    console.log(`[Smart Notifications] Scheduled: ${suggestion.title} (in ${delayMinutes}m)`);
  }

  // Update last notification time
  await updateLastNotificationTime();

  console.log(`[Smart Notifications] Scheduled ${toSchedule.length} notifications spread throughout the day`);
}

/**
 * Export preferences management functions
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const current = await getNotificationPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(
      '@weave:notification_preferences',
      JSON.stringify(updated)
    );
    console.log('[Smart Notifications] Preferences updated:', updated);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
  }
}

export async function getStoredNotificationPreferences(): Promise<NotificationPreferences> {
  return getNotificationPreferences();
}
