/**
 * Notification Manager
 * Handles scheduling and permission management for weekly reflection notifications
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_REFLECTION_KEY = '@weave:last_reflection_date';
const WEEKLY_NOTIFICATION_ID = 'weekly-reflection';

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
