/**
 * Enhanced Notification Manager
 * Handles all notification types:
 * - Daily battery check-in reminders
 * - Upcoming event reminders
 * - Post-weave deepening nudges
 * - Weekly reflection reminders
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../db';
import UserProfile from '../db/models/UserProfile';
import Interaction from '../db/models/Interaction';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';

// AsyncStorage keys
const LAST_REFLECTION_KEY = '@weave:last_reflection_date';
const LAST_BATTERY_NUDGE_KEY = '@weave:last_battery_nudge';
const DEEPENING_NUDGES_KEY = '@weave:deepening_nudges';

// Notification identifiers
const WEEKLY_REFLECTION_ID = 'weekly-reflection';
const DAILY_BATTERY_ID = 'daily-battery-checkin';
const EVENT_REMINDER_PREFIX = 'event-reminder-';
const DEEPENING_NUDGE_PREFIX = 'deepening-nudge-';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// ================================================================================
// DAILY BATTERY CHECK-IN NOTIFICATIONS
// ================================================================================

/**
 * Schedule daily battery check-in notification
 * @param time - Time in "HH:mm" format (24-hour), e.g., "20:00" for 8 PM
 */
export async function scheduleDailyBatteryCheckin(time: string = '20:00'): Promise<void> {
  try {
    // Cancel existing notification
    await Notifications.cancelScheduledNotificationAsync(DAILY_BATTERY_ID);

    // Parse time
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.error('Invalid time format:', time);
      return;
    }

    // Schedule new notification
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_BATTERY_ID,
      content: {
        title: "How's your energy today? 🌙",
        body: "Take 10 seconds to check in with your social battery.",
        data: { type: 'battery-checkin' },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    console.log(`[Notifications] Daily battery check-in scheduled for ${time}`);
  } catch (error) {
    console.error('Error scheduling daily battery check-in:', error);
  }
}

/**
 * Cancel daily battery check-in notification
 */
export async function cancelDailyBatteryCheckin(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_BATTERY_ID);
  console.log('[Notifications] Daily battery check-in cancelled');
}

/**
 * Update battery notification based on user preferences
 */
export async function updateBatteryNotificationFromProfile(): Promise<void> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();
    if (profiles.length === 0) return;

    const profile = profiles[0];

    if (profile.batteryCheckinEnabled) {
      const time = profile.batteryCheckinTime || '20:00';
      await scheduleDailyBatteryCheckin(time);
    } else {
      await cancelDailyBatteryCheckin();
    }
  } catch (error) {
    console.error('Error updating battery notification from profile:', error);
  }
}

// ================================================================================
// EVENT REMINDER NOTIFICATIONS
// ================================================================================

/**
 * Schedule reminder for an upcoming interaction
 * Sends notification 1 hour before the interaction time
 */
export async function scheduleEventReminder(interaction: Interaction): Promise<void> {
  try {
    // Only schedule for planned interactions with future dates
    if (interaction.status !== 'planned') return;

    const interactionDate = new Date(interaction.interactionDate);
    const now = new Date();

    // Don't schedule if interaction is in the past
    if (interactionDate <= now) return;

    // Calculate reminder time (1 hour before)
    const reminderTime = new Date(interactionDate.getTime() - 60 * 60 * 1000);

    // Don't schedule if reminder time is in the past
    if (reminderTime <= now) return;

    // Fetch friend names
    const friends = await interaction.friends.fetch();
    const friendNames = friends.map(f => f.name).join(', ');

    const notificationId = `${EVENT_REMINDER_PREFIX}${interaction.id}`;

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: `Upcoming: ${interaction.interactionCategory || interaction.activity || 'Connection'} 🗓️`,
        body: `With ${friendNames} in 1 hour`,
        data: {
          type: 'event-reminder',
          interactionId: interaction.id,
        },
      },
      trigger: reminderTime,
    });

    console.log(`[Notifications] Event reminder scheduled for ${interaction.id}`);
  } catch (error) {
    console.error('Error scheduling event reminder:', error);
  }
}

/**
 * Cancel event reminder for an interaction
 */
export async function cancelEventReminder(interactionId: string): Promise<void> {
  const notificationId = `${EVENT_REMINDER_PREFIX}${interactionId}`;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
  console.log(`[Notifications] Event reminder cancelled for ${interactionId}`);
}

/**
 * Schedule reminders for all upcoming planned interactions
 */
export async function scheduleAllEventReminders(): Promise<void> {
  try {
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    // Fetch all planned interactions in the next week
    const upcomingInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'planned'),
        Q.where('interaction_date', Q.gte(now)),
        Q.where('interaction_date', Q.lte(oneWeekFromNow))
      )
      .fetch();

    console.log(`[Notifications] Scheduling reminders for ${upcomingInteractions.length} events`);

    for (const interaction of upcomingInteractions) {
      await scheduleEventReminder(interaction);
    }
  } catch (error) {
    console.error('Error scheduling all event reminders:', error);
  }
}

// ================================================================================
// POST-WEAVE DEEPENING NUDGES
// ================================================================================

interface DeepeningNudge {
  interactionId: string;
  scheduledAt: number;
  notificationId: string;
}

/**
 * Get stored deepening nudges
 */
async function getDeepeningNudges(): Promise<DeepeningNudge[]> {
  try {
    const json = await AsyncStorage.getItem(DEEPENING_NUDGES_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error getting deepening nudges:', error);
    return [];
  }
}

/**
 * Save deepening nudges
 */
async function saveDeepeningNudges(nudges: DeepeningNudge[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DEEPENING_NUDGES_KEY, JSON.stringify(nudges));
  } catch (error) {
    console.error('Error saving deepening nudges:', error);
  }
}

/**
 * Schedule a deepening nudge after completing a weave
 * Sends notification 3-6 hours after the weave to encourage reflection
 */
export async function schedulePostWeaveDeepening(interaction: Interaction): Promise<void> {
  try {
    // Only for completed interactions
    if (interaction.status !== 'completed') return;

    // Don't schedule if interaction was logged more than 24 hours ago
    const interactionDate = new Date(interaction.interactionDate);
    const now = new Date();
    const hoursSince = (now.getTime() - interactionDate.getTime()) / (60 * 60 * 1000);

    if (hoursSince > 24) return;

    // Random delay between 3-6 hours for natural feeling
    const delayHours = 3 + Math.random() * 3;
    const delayMs = delayHours * 60 * 60 * 1000;
    const nudgeTime = new Date(now.getTime() + delayMs);

    // Fetch friend names
    const friends = await interaction.friends.fetch();
    const friendNames = friends.map(f => f.name);
    const primaryFriend = friendNames[0] || 'your friend';

    // Craft personalized message
    const messages = [
      `How was your time with ${primaryFriend}? ✨`,
      `Your weave with ${primaryFriend}—how did it feel? 🌙`,
      `Reflecting on ${primaryFriend}: any insights? 💭`,
      `That connection with ${primaryFriend}—what stood out? 🕸️`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    const notificationId = `${DEEPENING_NUDGE_PREFIX}${interaction.id}-${Date.now()}`;

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: randomMessage,
        body: "Tap to add a reflection and deepen this weave.",
        data: {
          type: 'deepening-nudge',
          interactionId: interaction.id,
          friendNames,
        },
      },
      trigger: nudgeTime,
    });

    // Store nudge metadata
    const nudges = await getDeepeningNudges();
    nudges.push({
      interactionId: interaction.id,
      scheduledAt: nudgeTime.getTime(),
      notificationId,
    });
    await saveDeepeningNudges(nudges);

    console.log(`[Notifications] Deepening nudge scheduled for ${interaction.id} at ${nudgeTime.toLocaleString()}`);
  } catch (error) {
    console.error('Error scheduling deepening nudge:', error);
  }
}

/**
 * Cancel deepening nudge for an interaction
 */
export async function cancelDeepeningNudge(interactionId: string): Promise<void> {
  try {
    const nudges = await getDeepeningNudges();
    const filtered = nudges.filter(n => n.interactionId !== interactionId);

    // Cancel all notifications for this interaction
    const toCancel = nudges.filter(n => n.interactionId === interactionId);
    for (const nudge of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(nudge.notificationId);
    }

    await saveDeepeningNudges(filtered);
    console.log(`[Notifications] Deepening nudge cancelled for ${interactionId}`);
  } catch (error) {
    console.error('Error cancelling deepening nudge:', error);
  }
}

/**
 * Clean up old deepening nudges (past scheduled time)
 */
export async function cleanupOldDeepeningNudges(): Promise<void> {
  try {
    const nudges = await getDeepeningNudges();
    const now = Date.now();
    const active = nudges.filter(n => n.scheduledAt > now);
    await saveDeepeningNudges(active);
  } catch (error) {
    console.error('Error cleaning up old deepening nudges:', error);
  }
}

// ================================================================================
// WEEKLY REFLECTION NOTIFICATIONS
// ================================================================================

/**
 * Schedule weekly reflection notification for Sunday at 7 PM
 */
export async function scheduleWeeklyReflection(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_REFLECTION_ID);

    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_REFLECTION_ID,
      content: {
        title: "Time to reflect on your weave 🕸️",
        body: "How did your friendships feel this week?",
        data: { type: 'weekly-reflection' },
      },
      trigger: {
        weekday: 1, // Sunday
        hour: 19,
        minute: 0,
        repeats: true,
      },
    });

    console.log('[Notifications] Weekly reflection scheduled');
  } catch (error) {
    console.error('Error scheduling weekly reflection:', error);
  }
}

/**
 * Get the last time user completed weekly reflection
 */
export async function getLastReflectionDate(): Promise<Date | null> {
  try {
    const dateString = await AsyncStorage.getItem(LAST_REFLECTION_KEY);
    return dateString ? new Date(dateString) : null;
  } catch (error) {
    console.error('Error getting last reflection date:', error);
    return null;
  }
}

/**
 * Mark weekly reflection as complete
 */
export async function markReflectionComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_REFLECTION_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error marking reflection complete:', error);
  }
}

/**
 * Check if weekly reflection should be shown
 */
export function shouldShowReflection(lastDate: Date | null): boolean {
  if (!lastDate) return true;
  const daysSince = (Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= 7;
}

/**
 * Cancel weekly reflection notification
 */
export async function cancelWeeklyReflection(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_REFLECTION_ID);
}

// ================================================================================
// MASTER SETUP & CLEANUP
// ================================================================================

/**
 * Initialize all notification systems
 * Call this on app launch
 */
export async function initializeNotifications(): Promise<void> {
  console.log('[Notifications] Initializing notification system...');

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('[Notifications] Permission denied, skipping setup');
    return;
  }

  // Setup all notification types
  await Promise.all([
    updateBatteryNotificationFromProfile(),
    scheduleWeeklyReflection(),
    scheduleAllEventReminders(),
    cleanupOldDeepeningNudges(),
  ]);

  console.log('[Notifications] All notifications initialized');
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notifications] All notifications cancelled');
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
