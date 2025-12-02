import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ScannedEvent } from '../../interactions/services/event-scanner';
import { format } from 'date-fns';
import { shouldSendAmbientLoggingNotification } from './notification-grace-periods';
import Logger from '@/shared/utils/Logger';

/**
 * Configure notification handler
 * This determines how notifications are displayed when app is in foreground
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

import { permissionService } from './permission.service';

/**
 * Request notification permissions
 * @deprecated Use permissionService.requestPermissions() instead
 */
export async function requestEventSuggestionPermissions(): Promise<boolean> {
  return await permissionService.requestPermissions();
}

/**
 * Schedule a notification suggesting to log a calendar event
 * Note: Only schedules if user meets grace period requirements (3+ days old, 2+ friends)
 */
export async function scheduleEventSuggestionNotification(
  event: ScannedEvent
): Promise<string | null> {
  try {
    // Check grace period before sending notification
    const gracePeriodCheck = await shouldSendAmbientLoggingNotification();
    if (!gracePeriodCheck.shouldSend) {
      Logger.info('[Notifications] Event suggestion NOT scheduled:', gracePeriodCheck.reason);
      return null;
    }

    // Check if we have permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      Logger.warn('[Notifications] No permission to send notifications');
      return null;
    }

    // Build notification content
    const friendNames = event.matchedFriends.map(m => m.friend.name).join(', ');
    const dateStr = format(event.startDate, 'EEEE, MMM d');

    const title = '🧵 Did you weave?';
    const body = `You had "${event.title}" with ${friendNames} on ${dateStr}. Tap to log it.`;

    // Get event emoji
    const emoji = getEventEmoji(event.eventType);

    // Schedule notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'event-suggestion',
          eventId: event.id,
          friendIds: event.matchedFriends.map(m => m.friend.id),
          eventTitle: event.title,
          eventDate: event.startDate.toISOString(),
          suggestedCategory: event.suggestedCategory,
          location: event.location,
          notes: event.notes,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        ...(Platform.OS === 'android' ? { channelId: 'event-suggestions' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        repeats: false,
      },
    });



    Logger.info(`[Notifications] Scheduled notification ${notificationId} for event: ${event.title}`);
    return notificationId;
  } catch (error) {
    Logger.error('[Notifications] Error scheduling notification:', error);
    return null;
  }
}

/**
 * Get emoji for event type
 */
function getEventEmoji(eventType: string): string {
  const emojiMap: Record<string, string> = {
    birthday: '🎂',
    anniversary: '💝',
    holiday: '🎉',
    meal: '🍽️',
    social: '🎊',
    activity: '🎯',
    celebration: '🎉',
    meeting: '👥',
    call: '📞',
    default: '📅',
  };

  return emojiMap[eventType] || emojiMap.default;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    Logger.info(`[Notifications] Cancelled notification ${notificationId}`);
  } catch (error) {
    Logger.error('[Notifications] Error cancelling notification:', error);
  }
}

/**
 * Cancel all event suggestion notifications
 */
export async function cancelAllEventSuggestions(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const eventSuggestions = scheduled.filter(
      n => n.content.data?.type === 'event-suggestion'
    );

    for (const notification of eventSuggestions) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }



    Logger.info(`[Notifications] Cancelled ${eventSuggestions.length} event suggestions`);
  } catch (error) {
    Logger.error('[Notifications] Error cancelling event suggestions:', error);
  }
}

/**
 * Get all pending event suggestion notifications
 */
export async function getPendingEventSuggestions(): Promise<Notifications.NotificationRequest[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.filter(n => n.content.data?.type === 'event-suggestion');
  } catch (error) {
    Logger.error('[Notifications] Error getting pending suggestions:', error);
    return [];
  }
}

/**
 * Handle notification tap - navigate to interaction form
 * Call this from notification response handler in app
 */
export function handleEventSuggestionTap(
  notification: Notifications.Notification,
  router: any
): boolean {
  try {
    const data = notification.request.content.data;

    if (data?.type !== 'event-suggestion') {
      return false;
    }

    // Extract event data
    const {
      friendIds,
      eventDate,
      eventTitle,
      suggestedCategory,
      location,
      notes,
    } = data as {
      friendIds: string[];
      eventDate: string;
      eventTitle: string;
      suggestedCategory?: string;
      location?: string;
      notes?: string;
    };

    // Build query params for interaction form
    const params = new URLSearchParams({
      type: 'log',
      friendIds: friendIds.join(','),
      date: eventDate,
      title: eventTitle,
    });

    if (suggestedCategory) {
      params.append('category', suggestedCategory);
    }

    if (location) {
      params.append('location', location);
    }

    if (notes) {
      params.append('notes', notes);
    }

    // Navigate to interaction form
    router.push(`/interaction-form?${params.toString()}`);

    Logger.info('[Notifications] Navigated to interaction form from notification');
    return true;
  } catch (error) {
    Logger.error('[Notifications] Error handling notification tap:', error);
    return false;
  }
}
