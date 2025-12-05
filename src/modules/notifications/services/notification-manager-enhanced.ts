/**
 * Notification Manager
 * Unified notification system handling all notification types:
 * - Daily battery check-in reminders
 * - Upcoming event reminders (1 hour before planned interactions)
 * - Post-weave deepening nudges (3-6 hours after logging)
 * - Weekly reflection reminders (Sunday at 7 PM)
 * - Memory nudges (anniversary reflections from one year ago)
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import Interaction from '@/db/models/Interaction';
import Friend from '@/db/models/Friend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import {
  shouldSendWeeklyReflectionNotification,
  shouldSendSocialBatteryNotification,
} from './notification-grace-periods';
import { getWeekRange, STORY_CHIPS } from '@/modules/reflection';
import Logger from '@/shared/utils/Logger';

// AsyncStorage keys
const LAST_REFLECTION_KEY = '@weave:last_reflection_date';
const DEEPENING_NUDGES_KEY = '@weave:deepening_nudges';
const NOTIFICATIONS_INITIALIZED_KEY = '@weave:notifications_initialized';
const LAST_MEMORY_CHECK_KEY = '@weave:last_memory_check';

// Notification identifiers
const WEEKLY_REFLECTION_ID = 'weekly-reflection';
const DAILY_BATTERY_ID = 'daily-battery-checkin';
const EVENT_REMINDER_PREFIX = 'event-reminder-';
const DEEPENING_NUDGE_PREFIX = 'deepening-nudge-';
const MEMORY_NUDGE_ID_PREFIX = 'memory-nudge-';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

import { permissionService } from './permission.service';

/**
 * Request notification permissions from the user
 * @deprecated Use permissionService.requestPermissions() instead
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  return await permissionService.requestPermissions();
}

// ================================================================================
// DAILY BATTERY CHECK-IN NOTIFICATIONS
// ================================================================================

/**
 * Schedule daily battery check-in notification
 * Note: Only schedules if user meets grace period requirements (48+ hours old, 3+ interactions)
 * @param time - Time in "HH:mm" format (24-hour), e.g., "20:00" for 8 PM
 */
/**
 * Schedule daily battery check-in notification
 * Note: Only schedules if user meets grace period requirements (48+ hours old, 3+ interactions)
 * @param time - Time in "HH:mm" format (24-hour), e.g., "20:00" for 8 PM
 * @param startDate - Optional date object for when the notification schedule should start (defaults to today/now)
 */
export async function scheduleDailyBatteryCheckin(time: string = '20:00', startDate?: Date): Promise<void> {
  try {
    // Cancel existing notification to ensure clean slate
    await Notifications.cancelScheduledNotificationAsync(DAILY_BATTERY_ID);

    // Check grace period before scheduling
    const gracePeriodCheck = await shouldSendSocialBatteryNotification();
    if (!gracePeriodCheck.shouldSend) {
      Logger.info('[Notifications] Skipping daily battery check-in due to grace period:', gracePeriodCheck.reason);
      return;
    }

    // Parse time
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      Logger.error('Invalid time format:', undefined, time);
      return;
    }

    // "Safety Net" Strategy: Batch Schedule for 14 Days
    // This allows us to easily "skip today" by just not scheduling today's slot, 
    // while maintaining reliability for the next 2 weeks even if app is not opened.
    const BATCH_DAYS = 14;
    const scheduleStart = startDate || new Date();

    // Logic: Schedule for next 14 days, skipping days before startDate
    for (let i = 0; i < BATCH_DAYS; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + i);
      targetDate.setHours(hour, minute, 0, 0);

      // If target is in the past, skip
      if (targetDate <= new Date()) continue;

      // If target is before requested start date, skip (e.g. skip today)
      if (startDate && targetDate < startDate) continue;

      const id = `${DAILY_BATTERY_ID}-${targetDate.toDateString()}`; // Unique ID per day

      // Schedule notification (overwrites if exists)
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: "How's your energy today? 🌙",
          body: "Take 10 seconds to check in with your social battery.",
          data: { type: 'battery-checkin' },
        },
        trigger: targetDate as any, // One-off accurate date
      });
    }

    Logger.info(`[Notifications] Scheduled managed batch of battery check-ins starting ${scheduleStart.toDateString()}`);

  } catch (error) {
    Logger.error('Error scheduling daily battery check-in:', error);
  }
}

/**
 * Reschedule battery check-in to start from tomorrow
 * (Used when user checks in today to silence today's reminder but keep habit safe)
 */
export async function rescheduleDailyBatteryCheckinForTomorrow(time: string = '20:00'): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Start of tomorrow

  // Cancel the "Main" recurring ID if it exists (legacy cleanup)
  await Notifications.cancelScheduledNotificationAsync(DAILY_BATTERY_ID);

  // Also cancel TODAY's specific batch ID if it exists
  const todayStr = new Date().toDateString();
  await Notifications.cancelScheduledNotificationAsync(`${DAILY_BATTERY_ID}-${todayStr}`);

  // Schedule batch starting tomorrow
  await scheduleDailyBatteryCheckin(time, tomorrow);
}

/**
 * Cancel daily battery check-in notification
 */
export async function cancelDailyBatteryCheckin(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_BATTERY_ID);

  // Also clean up batch notifications? 
  // If we want to fully disable, we should cancel all future ones.
  // Since we use date-based IDs, we can't efficiently "cancel all starting with prefix" without fetching list.

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(DAILY_BATTERY_ID)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
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

      // Determine start date based on last check-in
      // If checked in TODAY, start TOMORROW.
      // If NOT checked in today, start TODAY (if time hasn't passed) or TOMORROW (if time passed, handled by schedule logic)

      let startDate = new Date();
      if (profile.socialBatteryLastCheckin) {
        const lastCheckin = new Date(profile.socialBatteryLastCheckin);
        const today = new Date();
        if (lastCheckin.toDateString() === today.toDateString()) {
          // Already done today, start tomorrow
          startDate.setDate(startDate.getDate() + 1);
        }
      }

      await scheduleDailyBatteryCheckin(time, startDate);
    } else {
      await cancelDailyBatteryCheckin();
    }
  } catch (error) {
    Logger.error('Error updating battery notification from profile:', error);
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

    // Fetch friend names through join table
    const joinRecords = await database
      .get('interaction_friends')
      .query(Q.where('interaction_id', interaction.id))
      .fetch();

    const friendIds = joinRecords.map((jr: any) => jr.friendId);
    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('id', Q.oneOf(friendIds)))
      .fetch();

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
          friendId: friends.length > 0 ? friends[0].id : undefined,
          friendName: friendNames,
        },
      },
      trigger: reminderTime as any,
    });


  } catch (error) {
    Logger.error('Error scheduling event reminder:', error);
  }
}

/**
 * Cancel event reminder for an interaction
 */
export async function cancelEventReminder(interactionId: string): Promise<void> {
  const notificationId = `${EVENT_REMINDER_PREFIX}${interactionId}`;
  await Notifications.cancelScheduledNotificationAsync(notificationId);

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



    for (const interaction of upcomingInteractions) {
      await scheduleEventReminder(interaction);
    }
  } catch (error) {
    Logger.error('Error scheduling all event reminders:', error);
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
    Logger.error('Error getting deepening nudges:', error);
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
    Logger.error('Error saving deepening nudges:', error);
  }
}

/**
 * Schedule a deepening nudge after completing a weave
 * Sends notification 3-6 hours after the weave to encourage reflection
 * Limited to 2 nudges per day to avoid overwhelming the user
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

    // Limit to 2 deepening nudges per day
    const existingNudges = await getDeepeningNudges();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const todayNudges = existingNudges.filter(n => n.scheduledAt >= startOfDay.getTime());

    if (todayNudges.length >= 2) {

      return;
    }

    // Random delay between 3-6 hours for natural feeling
    const delayHours = 3 + Math.random() * 3;
    const delayMs = delayHours * 60 * 60 * 1000;
    const nudgeTime = new Date(now.getTime() + delayMs);

    // Fetch friend names through join table
    const joinRecords = await database
      .get('interaction_friends')
      .query(Q.where('interaction_id', interaction.id))
      .fetch();

    const friendIds = joinRecords.map((jr: any) => jr.friendId);
    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('id', Q.oneOf(friendIds)))
      .fetch();

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
          friendId: friends.length > 0 ? friends[0].id : undefined,
          friendName: primaryFriend,
        },
      },
      trigger: nudgeTime as any,
    });

    // Store nudge metadata
    const nudges = await getDeepeningNudges();
    nudges.push({
      interactionId: interaction.id,
      scheduledAt: nudgeTime.getTime(),
      notificationId,
    });
    await saveDeepeningNudges(nudges);


  } catch (error) {
    Logger.error('Error scheduling deepening nudge:', error);
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

  } catch (error) {
    Logger.error('Error cancelling deepening nudge:', error);
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
    Logger.error('Error cleaning up old deepening nudges:', error);
  }
}

// ================================================================================
// WEEKLY REFLECTION NOTIFICATIONS
// ================================================================================

/**
 * Schedule weekly reflection notification for Sunday at 7 PM
 * Note: Only schedules if user meets grace period requirements (7+ days old, 1+ interaction)
 */
export async function scheduleWeeklyReflection(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_REFLECTION_ID);

    // Check grace period before scheduling
    const gracePeriodCheck = await shouldSendWeeklyReflectionNotification();
    if (!gracePeriodCheck.shouldSend) {

      return;
    }

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
      } as any,
    });


  } catch (error) {
    Logger.error('Error scheduling weekly reflection:', error);
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
    Logger.error('Error getting last reflection date:', error);
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
    Logger.error('Error marking reflection complete:', error);
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
// MEMORY NUDGES (ANNIVERSARY REFLECTIONS)
// ================================================================================

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
            const chipData = STORY_CHIPS.find((c: any) => c.id === chip.chipId);
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
            weekRange: getWeekRange(reflection),
          },
        },
        trigger: notificationDate as any,
      });
    }


  } catch (error) {
    Logger.error('Error scheduling memory nudges:', error);
  }
}

/**
 * Check and schedule memory nudges on app open
 * Should be called when app starts or when user opens journal
 */
export async function checkAndScheduleMemoryNudges(): Promise<void> {
  try {
    // Check if we've already checked today
    const lastCheck = await AsyncStorage.getItem(LAST_MEMORY_CHECK_KEY);
    const today = new Date().toDateString();

    if (lastCheck === today) {
      return; // Already checked today
    }

    // Schedule memory nudges
    await scheduleMemoryNudges();

    // Mark as checked
    await AsyncStorage.setItem(LAST_MEMORY_CHECK_KEY, today);
  } catch (error) {
    Logger.error('Error checking memory nudges:', error);
  }
}

// ================================================================================
// MASTER SETUP & CLEANUP
// ================================================================================

/**
 * Check if notifications were already initialized today
 */
async function wasInitializedToday(): Promise<boolean> {
  try {
    const lastInit = await AsyncStorage.getItem(NOTIFICATIONS_INITIALIZED_KEY);
    if (!lastInit) return false;

    const lastInitDate = new Date(parseInt(lastInit, 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastInitDate.setHours(0, 0, 0, 0);

    return lastInitDate.getTime() === today.getTime();
  } catch (error) {
    Logger.error('Error checking notification initialization:', error);
    return false;
  }
}

/**
 * Mark notifications as initialized
 */
async function markAsInitialized(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_KEY, Date.now().toString());
  } catch (error) {
    Logger.error('Error marking notifications as initialized:', error);
  }
}

/**
 * Initialize all notification systems
 * Call this on app launch
 * Only reschedules if not already done today (prevents duplicate notifications)
 */
export async function initializeNotifications(): Promise<void> {


  // Check existing permissions WITHOUT requesting them
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== 'granted') {

    return;
  }

  // Check if we already initialized today
  const alreadyInitialized = await wasInitializedToday();
  if (alreadyInitialized) {

    // Only clean up old nudges, don't reschedule everything
    await cleanupOldDeepeningNudges();
    return;
  }



  // Setup all notification types
  await Promise.all([
    updateBatteryNotificationFromProfile(),
    scheduleWeeklyReflection(),
    scheduleAllEventReminders(),
    cleanupOldDeepeningNudges(),
    checkAndScheduleMemoryNudges(),
  ]);

  // Mark as initialized
  await markAsInitialized();


}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
