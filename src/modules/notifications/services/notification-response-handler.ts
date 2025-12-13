
/**
 * Notification Response Handler
 * Routes notification interactions to the appropriate channel handlers
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
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

      // Route to channel
      switch (type) {
        case 'battery-checkin':
          BatteryCheckinChannel.handleTap(data, router);
          break;
        case 'weekly-reflection':
          WeeklyReflectionChannel.handleTap(data, router);
          break;
        case 'event-reminder':
          EventReminderChannel.handleTap(data, router);
          break;
        case 'deepening-nudge':
          DeepeningNudgeChannel.handleTap(data, router);
          break;
        case 'memory-nudge':
          MemoryNudgeChannel.handleTap(data, router);
          break;
        case 'friend-suggestion':
          SmartSuggestionsChannel.handleTap(data, router);
          break;
        case 'event-suggestion':
          EventSuggestionChannel.handleTap(data, router);
          break;
        case 'evening-digest':
          EveningDigestChannel.handleTap(data, router);
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
      router.replace('/dashboard');
    }
  };

  return { handleResponse };
};
