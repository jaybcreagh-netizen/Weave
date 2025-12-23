
/**
 * Notification Response Handler
 * Routes notification interactions to the appropriate channel handlers
 */

import * as Notifications from 'expo-notifications';
import { useRouter, Router } from 'expo-router';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from './notification-analytics';
import { notificationStore } from './notification-store';
import { NotificationType } from '../types';

// Channels
import { BatteryCheckinChannel } from './channels/battery-checkin';
import { WeeklyReflectionChannel } from './channels/weekly-reflection';
import { EventReminderChannel } from './channels/event-reminder';
import { DeepeningNudgeChannel } from './channels/deepening-nudge';
import { MemoryNudgeChannel } from './channels/memory-nudge';
import { SmartSuggestionsChannel } from './channels/smart-suggestions';
import { EventSuggestionChannel } from './channels/event-suggestion';
import { EveningDigestChannel } from './channels/evening-digest';

/**
 * Safely execute a channel's handleTap with error isolation.
 * If a channel fails, falls back to dashboard navigation.
 */
const safeChannelHandleTap = async (
  channelName: string,
  handler: () => void | Promise<void>,
  router: Router
): Promise<void> => {
  try {
    await handler();
  } catch (error) {
    Logger.error(`[NotificationHandler] ${channelName} handleTap failed:`, error);
    // Fallback to dashboard on channel error
    try {
      router.replace('/dashboard');
    } catch (navError) {
      Logger.error('[NotificationHandler] Navigation fallback also failed:', navError);
    }
  }
};

export const useNotificationResponseHandler = () => {
  const router = useRouter();

  const handleResponse = async (response: Notifications.NotificationResponse) => {
    try {
      const data = response.notification.request.content.data;
      const type = data?.type as NotificationType;
      const actionId = response.actionIdentifier;

      Logger.info(`[NotificationHandler] Handling response for type: ${type}, action: ${actionId}`);

      // Track the interaction
      notificationAnalytics.trackTapped(type, actionId, data);

      // Reset ignore count for this type (user engaged!)
      if (type) {
        await notificationStore.resetIgnoreCount(type);
      }

      // If simply dismissing, track as ignore and return
      if (actionId === 'dismiss') {
        if (type) {
          await notificationStore.incrementIgnoreCount(type);
        }
        return;
      }

      // Route to channel with error isolation
      switch (type) {
        case 'battery-checkin':
          await safeChannelHandleTap('BatteryCheckin', () => BatteryCheckinChannel.handleTap(data, router), router);
          break;
        case 'weekly-reflection':
          await safeChannelHandleTap('WeeklyReflection', () => WeeklyReflectionChannel.handleTap(data, router), router);
          break;
        case 'event-reminder':
          await safeChannelHandleTap('EventReminder', () => EventReminderChannel.handleTap(data, router), router);
          break;
        case 'deepening-nudge':
          await safeChannelHandleTap('DeepeningNudge', () => DeepeningNudgeChannel.handleTap(data, router), router);
          break;
        case 'memory-nudge':
          await safeChannelHandleTap('MemoryNudge', () => MemoryNudgeChannel.handleTap(data, router), router);
          break;
        case 'friend-suggestion':
          await safeChannelHandleTap('SmartSuggestions', () => SmartSuggestionsChannel.handleTap(data, router), router);
          break;
        case 'event-suggestion':
          await safeChannelHandleTap('EventSuggestion', () => EventSuggestionChannel.handleTap(data, router), router);
          break;
        case 'evening-digest':
          await safeChannelHandleTap('EveningDigest', () => EveningDigestChannel.handleTap(data, router), router);
          break;

        default:
          // Default fallback
          Logger.warn(`[NotificationHandler] Unknown notification type: ${type}`);
          router.replace('/dashboard');
          break;
      }

    } catch (error) {
      Logger.error('[NotificationHandler] Error handling response:', error);
      // Fallback to dashboard on error
      try {
        router.replace('/dashboard');
      } catch (navError) {
        Logger.error('[NotificationHandler] Navigation fallback failed:', navError);
      }
    }
  };

  return { handleResponse };
};
