/**
 * Notification Response Handler
 * Handles deep linking when users tap on notifications
 * Routes to appropriate screens/modals based on notification type
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '@/stores/uiStore';

export interface NotificationData {
  type:
  | 'battery-checkin'
  | 'weekly-reflection'
  | 'event-reminder'
  | 'deepening-nudge'
  | 'friend-suggestion'
  | 'portfolio-insight'
  | 'life-event'
  | 'memory-nudge'
  | 'event-suggestion';

  // Optional navigation data
  friendId?: string;
  friendName?: string;
  interactionId?: string;
  suggestionId?: string;
  reflectionId?: string;
  weekRange?: string;

  // Event suggestion specific data
  eventId?: string;
  friendIds?: string[];
  eventTitle?: string;
  eventDate?: string;
  suggestedCategory?: string;
  location?: string;
  notes?: string;
}

/**
 * Handle notification tap and navigate to appropriate screen
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData;



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

    case 'event-suggestion':
      handleEventSuggestionNotification(data);
      break;

    default:
      console.warn('[Notifications] Unknown notification type:', data.type);
  }
}

/**
 * Navigate to home tab and trigger battery check-in modal
 */
function handleBatteryCheckinNotification(): void {
  // Navigate to dashboard first
  if (router.canGoBack()) {
    router.dismissAll();
  }
  router.replace('/dashboard');

  // Open the sheet via global store
  setTimeout(() => {
    useUIStore.getState().openSocialBatterySheet();
  }, 500);
}

/**
 * Navigate to home tab and trigger weekly reflection modal
 */
function handleWeeklyReflectionNotification(): void {
  // Navigate to dashboard first
  if (router.canGoBack()) {
    router.dismissAll();
  }
  router.replace('/dashboard');

  // Open the modal via global store
  setTimeout(() => {
    useUIStore.getState().openWeeklyReflection();
  }, 500);
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
  // Navigate to dashboard
  if (router.canGoBack()) {
    router.dismissAll();
  }
  router.replace('/dashboard');

  // Trigger memory reflection modal via URL parameter (if Home supports it)
  // For now, mapping to Weekly Reflection as fallback or specific memory modal if exists
  setTimeout(() => {
    useUIStore.getState().openWeeklyReflection();
    // TODO: Pass memory specific data if WeeklyReflectionModal supports it
  }, 500);
}

/**
 * Navigate to interaction form with pre-filled data from calendar event
 */
function handleEventSuggestionNotification(data: NotificationData): void {
  if (!data.friendIds || data.friendIds.length === 0) {
    console.warn('[Notifications] Event suggestion missing friend IDs');
    router.push('/(tabs)/friends');
    return;
  }

  // Build query params for interaction form
  const params = new URLSearchParams({
    type: 'log',
    friendIds: data.friendIds.join(','),
  });

  if (data.eventDate) {
    params.append('date', data.eventDate);
  }

  if (data.eventTitle) {
    params.append('title', data.eventTitle);
  }

  if (data.suggestedCategory) {
    params.append('category', data.suggestedCategory);
  }

  if (data.location) {
    params.append('location', data.location);
  }

  if (data.notes) {
    params.append('notes', data.notes);
  }

  // Navigate to interaction form
  router.push(`/interaction-form?${params.toString()}`);
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



  // Return cleanup function
  return () => {
    subscription.remove();

  };
}

/**
 * Check if app was launched by a notification
 * Call this on app mount to handle cold starts
 */
export async function handleNotificationOnLaunch(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();

  if (response) {

    handleNotificationResponse(response);
  }
}
