import PostHog from 'posthog-react-native';

/**
 * PostHog Analytics Configuration
 *
 * Privacy-friendly, open-source product analytics
 *
 * To enable:
 * 1. Sign up at https://posthog.com (free tier available)
 * 2. Get your API key and host URL
 * 3. Replace POSTHOG_API_KEY and POSTHOG_HOST below
 */

const POSTHOG_API_KEY = ''; // TODO: Add your PostHog API key
const POSTHOG_HOST = 'https://app.posthog.com'; // Or your self-hosted instance

let posthogClient: PostHog | null = null;

export async function initializePostHog() {
  // Skip initialization if no API key is configured
  if (!POSTHOG_API_KEY) {
    console.log('[PostHog] Skipped - No API key configured');
    return;
  }

  try {
    posthogClient = await PostHog.initAsync(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,

      // Disable in development
      disabled: __DEV__,

      // Capture app lifecycle events automatically
      captureApplicationLifecycleEvents: true,

      // Capture screen views automatically
      captureScreenViews: true,
    });

    console.log('[PostHog] Initialized successfully');
  } catch (error) {
    console.error('[PostHog] Failed to initialize:', error);
  }
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (__DEV__) {
    console.log(`[PostHog] Event (dev mode - not sending):`, eventName, properties);
    return;
  }

  if (!posthogClient) {
    console.warn('[PostHog] Client not initialized');
    return;
  }

  posthogClient.capture(eventName, properties);
}

/**
 * Identify a user (call after onboarding or profile creation)
 */
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (__DEV__) {
    console.log(`[PostHog] Identify (dev mode - not sending):`, userId, properties);
    return;
  }

  if (!posthogClient) {
    console.warn('[PostHog] Client not initialized');
    return;
  }

  posthogClient.identify(userId, properties);
}

/**
 * Track screen view
 */
export function trackScreen(screenName: string, properties?: Record<string, any>) {
  if (__DEV__) {
    console.log(`[PostHog] Screen (dev mode - not sending):`, screenName, properties);
    return;
  }

  if (!posthogClient) {
    console.warn('[PostHog] Client not initialized');
    return;
  }

  posthogClient.screen(screenName, properties);
}

/**
 * Reset user session (call on logout)
 */
export function resetUser() {
  if (!posthogClient) return;
  posthogClient.reset();
}

/**
 * Flush events immediately (useful before app closes)
 */
export async function flushEvents() {
  if (!posthogClient) return;
  await posthogClient.flush();
}

// Pre-defined events for common app actions
export const AnalyticsEvents = {
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Friend Management
  FRIEND_ADDED: 'friend_added',
  FRIEND_EDITED: 'friend_edited',
  FRIEND_DELETED: 'friend_deleted',
  FRIEND_ARCHIVED: 'friend_archived',

  // Interactions
  INTERACTION_LOGGED: 'interaction_logged',
  INTERACTION_PLANNED: 'interaction_planned',
  INTERACTION_COMPLETED: 'interaction_completed',
  QUICK_WEAVE_OPENED: 'quick_weave_opened',
  QUICK_WEAVE_SUBMITTED: 'quick_weave_submitted',

  // Intentions
  INTENTION_CREATED: 'intention_created',
  INTENTION_COMPLETED: 'intention_completed',

  // Battery & Reflections
  BATTERY_UPDATED: 'battery_updated',
  REFLECTION_COMPLETED: 'reflection_completed',

  // Achievements
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  TROPHY_CABINET_VIEWED: 'trophy_cabinet_viewed',

  // Settings
  SETTINGS_CHANGED: 'settings_changed',
  NOTIFICATIONS_TOGGLED: 'notifications_toggled',
  THEME_CHANGED: 'theme_changed',

  // Suggestions
  SUGGESTION_SHOWN: 'suggestion_shown',
  SUGGESTION_ACTED: 'suggestion_acted',
  SUGGESTION_DISMISSED: 'suggestion_dismissed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  APP_CRASHED: 'app_crashed',
} as const;

export default posthogClient;
