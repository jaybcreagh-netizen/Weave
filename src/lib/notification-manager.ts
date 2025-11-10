/**
 * Notification Manager
 * Handles scheduling and permission management for weekly reflection notifications
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../db';
import WeeklyReflection from '../db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';

const LAST_REFLECTION_KEY = '@weave:last_reflection_date';
const WEEKLY_NOTIFICATION_ID = 'weekly-reflection';
const MEMORY_NUDGE_ID_PREFIX = 'memory-nudge-';

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

/**
 * Schedule weekly reflection notification for Sunday at 7 PM
 */
export async function scheduleWeeklyReflection(): Promise<void> {
  // Cancel existing notification if any
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_NOTIFICATION_ID);

  // Schedule new weekly notification
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_NOTIFICATION_ID,
    content: {
      title: "Time to reflect on your weave 🕸️",
      body: "How did your friendships feel this week?",
      data: { type: 'weekly-reflection' },
    },
    trigger: {
      weekday: 1, // Sunday (1 = Sunday, 2 = Monday, etc.)
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
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
 * Returns true if more than 7 days since last reflection or never reflected
 */
export function shouldShowReflection(lastDate: Date | null): boolean {
  if (!lastDate) return true;

  const daysSince = (Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= 7;
}

/**
 * Cancel all scheduled reflection notifications
 */
export async function cancelWeeklyReflection(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_NOTIFICATION_ID);
}

/**
 * Check for reflections from exactly a year ago and schedule memory nudges
 * Call this daily to check for anniversary reflections
 */
export async function scheduleMemoryNudges(): Promise<void> {
  try {
    // Get date range for this week from exactly one year ago
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // Check for reflections from a week around this date last year
    // (±3 days to catch reflections even if dates don't align perfectly)
    const startRange = new Date(oneYearAgo);
    startRange.setDate(startRange.getDate() - 3);
    const endRange = new Date(oneYearAgo);
    endRange.setDate(endRange.getDate() + 3);

    const reflections = await database
      .get<WeeklyReflection>('weekly_reflections')
      .query(
        Q.where('week_end_date', Q.gte(startRange.getTime())),
        Q.where('week_end_date', Q.lte(endRange.getTime()))
      )
      .fetch();

    // Cancel any existing memory nudge notifications
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allNotifications) {
      if (notification.identifier.startsWith(MEMORY_NUDGE_ID_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // Schedule notifications for each anniversary reflection
    for (const reflection of reflections) {
      // Get meaningful preview text
      let previewText = '';
      if (reflection.gratitudeText && reflection.gratitudeText.length > 0) {
        previewText = reflection.gratitudeText.substring(0, 100);
        if (reflection.gratitudeText.length > 100) previewText += '...';
      } else if (reflection.storyChips.length > 0) {
        const chipLabels = reflection.storyChips
          .map(chip => {
            const chipData = require('./story-chips').STORY_CHIPS.find((c: any) => c.id === chip.chipId);
            return chipData?.plainText;
          })
          .filter(Boolean)
          .join(', ');
        previewText = `Themes: ${chipLabels}`;
      } else {
        previewText = `${reflection.totalWeaves} weaves with ${reflection.friendsContacted} friends`;
      }

      // Schedule notification for tomorrow morning at 9 AM
      const notificationDate = new Date();
      notificationDate.setDate(notificationDate.getDate() + 1);
      notificationDate.setHours(9, 0, 0, 0);

      await Notifications.scheduleNotificationAsync({
        identifier: `${MEMORY_NUDGE_ID_PREFIX}${reflection.id}`,
        content: {
          title: '🌙 A year ago this week...',
          body: previewText,
          data: {
            type: 'memory-nudge',
            reflectionId: reflection.id,
            weekRange: reflection.getWeekRange(),
          },
        },
        trigger: notificationDate,
      });
    }
  } catch (error) {
    console.error('Error scheduling memory nudges:', error);
  }
}

/**
 * Check and schedule memory nudges on app open
 * Should be called when app starts or when user opens journal
 */
export async function checkAndScheduleMemoryNudges(): Promise<void> {
  try {
    // Check if we've already checked today
    const lastCheckKey = '@weave:last_memory_check';
    const lastCheck = await AsyncStorage.getItem(lastCheckKey);
    const today = new Date().toDateString();

    if (lastCheck === today) {
      return; // Already checked today
    }

    // Schedule memory nudges
    await scheduleMemoryNudges();

    // Mark as checked
    await AsyncStorage.setItem(lastCheckKey, today);
  } catch (error) {
    console.error('Error checking memory nudges:', error);
  }
}
