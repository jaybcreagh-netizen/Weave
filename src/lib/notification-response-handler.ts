/**
 * Notification Response Handler
 * Handles deep linking when users tap on notifications
 * Routes to appropriate screens/modals based on notification type
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../stores/uiStore';

export interface NotificationData {
  type:
    | 'battery-checkin'
    | 'weekly-reflection'
    | 'event-reminder'
    | 'deepening-nudge'
    | 'friend-suggestion'
    | 'portfolio-insight'
    | 'life-event'
    | 'memory-nudge';

  // Optional navigation data
  friendId?: string;
  friendName?: string;
  interactionId?: string;
  suggestionId?: string;
  reflectionId?: string;
  weekRange?: string;
}

/**
 * Handle notification tap and navigate to appropriate screen
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData;

  console.log('[Notifications] User tapped notification:', data);

  // Provide haptic feedback for notification tap
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  if (!data?.type) {
    console.warn('[Notifications] No type in notification data, ignoring');
    return;
  }

  // Handle different notification types
  switch (data.type) {
    case 'battery-checkin':
      handleBatteryCheckinNotification();
      break;

    case 'weekly-reflection':
      handleWeeklyReflectionNotification();
      break;

    case 'event-reminder':
      handleEventReminderNotification(data);
      break;

    case 'deepening-nudge':
      handleDeepeningNudgeNotification(data);
      break;

    case 'friend-suggestion':
      handleFriendSuggestionNotification(data);
      break;

    case 'portfolio-insight':
      handlePortfolioInsightNotification();
      break;

    case 'life-event':
      handleLifeEventNotification(data);
      break;

    case 'memory-nudge':
      handleMemoryNudgeNotification(data);
      break;

    default:
      console.warn('[Notifications] Unknown notification type:', data.type);
  }
}

/**
 * Navigate to home tab and trigger battery check-in modal
 */
function handleBatteryCheckinNotification(): void {
  // Navigate to home tab
  router.push('/(tabs)/home');

  // Trigger battery sheet via a URL parameter or global state
  // We'll use a URL parameter that home.tsx can read
  setTimeout(() => {
    router.setParams({ showBattery: 'true' });
  }, 300);
}

/**
 * Navigate to home tab and trigger weekly reflection modal
 */
function handleWeeklyReflectionNotification(): void {
  // Navigate to home tab
  router.push('/(tabs)/home');

  // Trigger weekly reflection via URL parameter
  setTimeout(() => {
    router.setParams({ showReflection: 'true' });
  }, 300);
}

/**
 * Navigate to the specific friend related to an event reminder
 */
function handleEventReminderNotification(data: NotificationData): void {
  if (data.friendId) {
    // Navigate to friend profile
    router.push({
      pathname: '/friend-profile',
      params: { id: data.friendId },
    });
  } else if (data.interactionId) {
    // If we only have interaction ID, navigate to friends tab
    // The interaction should be visible in their calendar view
    router.push('/(tabs)/friends');
  } else {
    // Fallback to friends tab
    router.push('/(tabs)/friends');
  }
}

/**
 * Navigate to friend profile with reflection prompt for deepening
 */
function handleDeepeningNudgeNotification(data: NotificationData): void {
  if (data.friendId) {
    // Navigate to friend profile
    router.push({
      pathname: '/friend-profile',
      params: {
        id: data.friendId,
        showReflection: 'true',
        interactionId: data.interactionId,
      },
    });
  } else {
    // Fallback to friends tab
    router.push('/(tabs)/friends');
  }
}

/**
 * Navigate to specific friend mentioned in suggestion
 */
function handleFriendSuggestionNotification(data: NotificationData): void {
  if (data.friendId) {
    // Navigate directly to friend profile
    router.push({
      pathname: '/friend-profile',
      params: { id: data.friendId },
    });
  } else {
    // Navigate to friends tab to see suggestions
    router.push('/(tabs)/friends');
  }
}

/**
 * Navigate to friends tab to view portfolio insights
 */
function handlePortfolioInsightNotification(): void {
  // Portfolio insights are best viewed from the friends tab
  router.push('/(tabs)/friends');
}

/**
 * Navigate to friend profile for life event (birthday, anniversary, etc)
 */
function handleLifeEventNotification(data: NotificationData): void {
  if (data.friendId) {
    // Navigate to friend profile
    router.push({
      pathname: '/friend-profile',
      params: {
        id: data.friendId,
        highlightEvent: 'true',
      },
    });
  } else {
    // Fallback to friends tab
    router.push('/(tabs)/friends');
  }
}

/**
 * Navigate to home tab and show anniversary reflection
 */
function handleMemoryNudgeNotification(data: NotificationData): void {
  // Navigate to home tab
  router.push('/(tabs)/home');

  // Trigger memory reflection modal via URL parameter
  setTimeout(() => {
    router.setParams({
      showMemory: 'true',
      reflectionId: data.reflectionId,
    });
  }, 300);
}

/**
 * Setup notification response listener
 * Call this in app/_layout.tsx on mount
 */
export function setupNotificationResponseListener(): () => void {
  // Handle notification taps when app is in foreground or background
  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  console.log('[Notifications] Response listener registered');

  // Return cleanup function
  return () => {
    subscription.remove();
    console.log('[Notifications] Response listener removed');
  };
}

/**
 * Check if app was launched by a notification
 * Call this on app mount to handle cold starts
 */
export async function handleNotificationOnLaunch(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();

  if (response) {
    console.log('[Notifications] App launched via notification');
    handleNotificationResponse(response);
  }
}
