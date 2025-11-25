import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ScannedEvent } from '../../interactions/services/event-scanner';
import { format } from 'date-fns';
import { shouldSendAmbientLoggingNotification } from './notification-grace-periods';

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

/**
 * Request notification permissions
 */
export async function requestEventSuggestionPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return false;
    }

    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('event-suggestions', {
        name: 'Event Suggestions',
        description: 'Suggestions to log calendar events as weaves',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B7FD6',
      });
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Error requesting permissions:', error);
    return false;
  }
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
      console.log('[Notifications] Event suggestion NOT scheduled:', gracePeriodCheck.reason);
      return null;
    }

    // Check if we have permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Notifications] No permission to send notifications');
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
      },
      trigger: {
        seconds: 10, // Show notification in 10 seconds (immediate but not instant)
        channelId: Platform.OS === 'android' ? 'event-suggestions' : undefined,
      },
    });

    console.log(`[Notifications] Scheduled notification ${notificationId} for event: ${event.title}`);
    return notificationId;
  } catch (error) {
    console.error('[Notifications] Error scheduling notification:', error);
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
    console.log(`[Notifications] Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('[Notifications] Error cancelling notification:', error);
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

    console.log(`[Notifications] Cancelled ${eventSuggestions.length} event suggestions`);
  } catch (error) {
    console.error('[Notifications] Error cancelling event suggestions:', error);
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
    console.error('[Notifications] Error getting pending suggestions:', error);
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

    console.log('[Notifications] Navigated to interaction form from notification');
    return true;
  } catch (error) {
    console.error('[Notifications] Error handling notification tap:', error);
    return false;
  }
}
