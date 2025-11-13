/**
 * Notification Response Handler
 * Handles deep linking when users tap on notifications
 * Routes to appropriate screens/modals based on notification type
 */

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
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
    | 'onboarding'
    | 'reengagement'
    | 'decay-warning'
    | 'milestone';

  // Optional navigation data
  friendId?: string;
  friendName?: string;
  interactionId?: string;
  suggestionId?: string;

  // Retention-specific data
  step?: string;
  reason?: string;
  currentScore?: number;
  milestone?: string;
  count?: number;
  days?: number;
  onboarding?: boolean;
}

/**
 * Handle notification tap and navigate to appropriate screen
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationData;

  console.log('[Notifications] User tapped notification:', data);

  if (!data?.type) {
    console.warn('[Notifications] No type in notification data, ignoring');
    return;
  }

  // Handle different notification types
  switch (data.type) {
    case 'battery-checkin':
      handleBatteryCheckinNotification(data);
      break;

    case 'weekly-reflection':
      handleWeeklyReflectionNotification(data);
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

    case 'onboarding':
      handleOnboardingNotification(data);
      break;

    case 'reengagement':
      handleReengagementNotification(data);
      break;

    case 'decay-warning':
      handleDecayWarningNotification(data);
      break;

    case 'milestone':
      handleMilestoneNotification(data);
      break;

    default:
      console.warn('[Notifications] Unknown notification type:', data.type);
  }
}

/**
 * Navigate to home tab and trigger battery check-in modal
 */
function handleBatteryCheckinNotification(data: NotificationData): void {
  // Navigate to home tab
  router.push('/(tabs)/home');

  // Trigger battery sheet via a URL parameter or global state
  // We'll use a URL parameter that home.tsx can read
  setTimeout(() => {
    router.setParams({ showBattery: 'true' });
  }, 300);

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
}

/**
 * Navigate to home tab and trigger weekly reflection modal
 */
function handleWeeklyReflectionNotification(data: NotificationData): void {
  // Navigate to home tab
  router.push('/(tabs)/home');

  // Trigger weekly reflection via URL parameter
  setTimeout(() => {
    router.setParams({ showReflection: 'true' });
  }, 300);

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
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
 * Handle onboarding notification tap
 */
function handleOnboardingNotification(data: NotificationData): void {
  // Complete the onboarding step
  if (data.step) {
    import('../lib/retention-notification-manager').then(({ completeOnboardingStep }) => {
      completeOnboardingStep(data.step!);
    });
  }

  // Navigate based on step
  if (data.step === 'first-weave') {
    // Open Quick Weave overlay
    router.push('/(tabs)/home');
    setTimeout(() => {
      router.setParams({ openQuickWeave: 'true' });
    }, 300);
  } else if (data.step === 'learn-archetypes' || data.step === 'learn-planning') {
    // Navigate to friends tab
    router.push('/(tabs)/friends');
  } else {
    // Default to home
    router.push('/(tabs)/home');
  }

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
}

/**
 * Handle re-engagement notification tap
 */
function handleReengagementNotification(data: NotificationData): void {
  // Navigate to home or friends tab depending on reason
  if (data.reason === 'weave-absence' && data.friendId) {
    // Take them directly to the friend who needs attention
    router.push({
      pathname: '/friend-profile',
      params: { id: data.friendId },
    });
  } else if (data.reason === 'weave-absence') {
    // Show friends list
    router.push('/(tabs)/friends');
  } else {
    // General re-engagement - show home
    router.push('/(tabs)/home');
  }

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
}

/**
 * Handle decay warning notification tap
 */
function handleDecayWarningNotification(data: NotificationData): void {
  if (data.friendId) {
    // Navigate to friend profile
    router.push({
      pathname: '/friend-profile',
      params: { id: data.friendId },
    });

    // Cancel the warning since user is engaging
    import('../lib/retention-notification-manager').then(({ cancelDecayWarning }) => {
      cancelDecayWarning(data.friendId!);
    });
  } else {
    // Fallback to friends tab
    router.push('/(tabs)/friends');
  }

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
}

/**
 * Handle milestone notification tap
 */
function handleMilestoneNotification(data: NotificationData): void {
  // Show a celebration view - for now navigate to home with a flag
  router.push('/(tabs)/home');

  // Could add a URL param to trigger celebration modal
  if (data.milestone && data.count) {
    setTimeout(() => {
      router.setParams({
        celebrateMilestone: data.milestone,
        milestoneValue: data.count.toString(),
      });
    }, 300);
  }

  // Track engagement
  import('../lib/retention-notification-manager').then(({ trackNotificationEngagement }) => {
    trackNotificationEngagement('opened');
  });
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
