import { PostHog } from 'posthog-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// PostHog instance
let posthogInstance: PostHog | null = null;

// Analytics events
export const AnalyticsEvents = {
  // App Lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',

  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',

  // Friends
  FRIEND_ADDED: 'friend_added',
  FRIEND_UPDATED: 'friend_updated',
  FRIEND_DELETED: 'friend_deleted',
  FRIEND_BATCH_ADDED: 'friend_batch_added',
  FRIEND_PROFILE_VIEWED: 'friend_profile_viewed',

  // Interactions
  INTERACTION_LOGGED: 'interaction_logged',
  INTERACTION_PLANNED: 'interaction_planned',
  INTERACTION_UPDATED: 'interaction_updated',
  INTERACTION_DELETED: 'interaction_deleted',
  INTERACTION_COMPLETED: 'interaction_completed',

  // Quick Weave
  QUICK_WEAVE_OPENED: 'quick_weave_opened',
  QUICK_WEAVE_SUBMITTED: 'quick_weave_submitted',
  QUICK_WEAVE_CANCELLED: 'quick_weave_cancelled',

  // Retention & Churn
  DAILY_ACTIVE_USER: 'daily_active_user',
  WEEKLY_ACTIVE_USER: 'weekly_active_user',
  USER_RETURNED: 'user_returned',
  USER_AT_RISK: 'user_at_risk', // 3+ days no interaction
  USER_CHURNED: 'user_churned', // 5+ days no app open

  // Features
  CALENDAR_INTEGRATION_ENABLED: 'calendar_integration_enabled',
  NOTIFICATION_ENABLED: 'notification_enabled',
  BATTERY_CHECKIN_COMPLETED: 'battery_checkin_completed',
  WEEKLY_REFLECTION_COMPLETED: 'weekly_reflection_completed',

  // Insights & Analytics
  INSIGHTS_VIEWED: 'insights_viewed',
  YEAR_IN_MOONS_VIEWED: 'year_in_moons_viewed',
  TROPHY_CABINET_VIEWED: 'trophy_cabinet_viewed',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',

  // Settings
  SETTINGS_OPENED: 'settings_opened',
  THEME_CHANGED: 'theme_changed',

  // Feedback
  FEEDBACK_SUBMITTED: 'feedback_submitted',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

export type AnalyticsEvent = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];

/**
 * Initialize PostHog analytics
 */
export async function initializeAnalytics(): Promise<void> {
  try {
    // Replace with your actual PostHog API key and host
    const POSTHOG_API_KEY = 'phc_YOUR_API_KEY'; // TODO: Replace with actual key
    const POSTHOG_HOST = 'https://app.posthog.com'; // Or your self-hosted instance

    // Skip in development if you want
    if (__DEV__ && false) {
      console.log('[Analytics] Skipping PostHog initialization in dev mode');
      return;
    }

    posthogInstance = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Enable session recording (optional)
      captureMode: 'screen',
      // iOS specific options
      ios: {
        captureApplicationLifecycleEvents: true,
        captureScreenViews: true,
      },
      // Android specific options
      android: {
        captureApplicationLifecycleEvents: true,
        captureScreenViews: true,
      },
    });

    // Identify the user with a unique ID
    const userId = await getOrCreateUserId();
    posthogInstance.identify(userId, {
      platform: Platform.OS,
      version: Constants.expoConfig?.version || 'unknown',
    });

    console.log('[Analytics] PostHog initialized');
  } catch (error) {
    console.error('[Analytics] Failed to initialize PostHog:', error);
  }
}

/**
 * Get or create a unique user ID
 */
async function getOrCreateUserId(): Promise<string> {
  try {
    let userId = await AsyncStorage.getItem('@weave:user_id');
    if (!userId) {
      // Generate a unique ID
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@weave:user_id', userId);
    }
    return userId;
  } catch (error) {
    console.error('[Analytics] Failed to get/create user ID:', error);
    return 'unknown';
  }
}

/**
 * Track an analytics event
 */
export function trackEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, any>
): void {
  try {
    if (!posthogInstance) {
      console.warn('[Analytics] PostHog not initialized, skipping event:', event);
      return;
    }

    const enrichedProperties = {
      ...properties,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };

    posthogInstance.capture(event, enrichedProperties);

    if (__DEV__) {
      console.log('[Analytics] Event tracked:', event, enrichedProperties);
    }
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * Track screen view
 */
export function trackScreenView(screenName: string, properties?: Record<string, any>): void {
  trackEvent('screen_viewed', {
    screen_name: screenName,
    ...properties,
  });
}

/**
 * Set user properties
 */
export function setUserProperties(properties: Record<string, any>): void {
  try {
    if (!posthogInstance) {
      console.warn('[Analytics] PostHog not initialized, skipping user properties');
      return;
    }

    posthogInstance.setPersonPropertiesForFlags(properties);
  } catch (error) {
    console.error('[Analytics] Failed to set user properties:', error);
  }
}

/**
 * Track retention metrics
 */
export async function trackRetentionMetrics(): Promise<void> {
  try {
    const now = Date.now();

    // Get last app open timestamp
    const lastAppOpenStr = await AsyncStorage.getItem('@weave:last_app_open');
    const lastAppOpen = lastAppOpenStr ? parseInt(lastAppOpenStr, 10) : now;

    // Get last interaction timestamp
    const lastInteractionStr = await AsyncStorage.getItem('@weave:last_interaction');
    const lastInteraction = lastInteractionStr ? parseInt(lastInteractionStr, 10) : now;

    const daysSinceLastOpen = (now - lastAppOpen) / (1000 * 60 * 60 * 24);
    const daysSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60 * 24);

    // Track daily active user
    trackEvent(AnalyticsEvents.DAILY_ACTIVE_USER, {
      days_since_last_open: daysSinceLastOpen,
      days_since_last_interaction: daysSinceLastInteraction,
    });

    // Track user returned (if more than 1 day since last open)
    if (daysSinceLastOpen >= 1 && daysSinceLastOpen < 5) {
      trackEvent(AnalyticsEvents.USER_RETURNED, {
        days_away: daysSinceLastOpen,
      });
    }

    // Track at-risk user (3+ days since last interaction)
    if (daysSinceLastInteraction >= 3 && daysSinceLastInteraction < 5) {
      trackEvent(AnalyticsEvents.USER_AT_RISK, {
        days_since_interaction: daysSinceLastInteraction,
      });
    }

    // Track churned user (5+ days since app open)
    if (daysSinceLastOpen >= 5) {
      trackEvent(AnalyticsEvents.USER_CHURNED, {
        days_away: daysSinceLastOpen,
      });
    }

    // Update last app open timestamp
    await AsyncStorage.setItem('@weave:last_app_open', now.toString());

    // Track weekly active user
    const lastWeeklyTrackStr = await AsyncStorage.getItem('@weave:last_weekly_track');
    const lastWeeklyTrack = lastWeeklyTrackStr ? parseInt(lastWeeklyTrackStr, 10) : 0;
    const daysSinceWeeklyTrack = (now - lastWeeklyTrack) / (1000 * 60 * 60 * 24);

    if (daysSinceWeeklyTrack >= 7) {
      trackEvent(AnalyticsEvents.WEEKLY_ACTIVE_USER);
      await AsyncStorage.setItem('@weave:last_weekly_track', now.toString());
    }
  } catch (error) {
    console.error('[Analytics] Failed to track retention metrics:', error);
  }
}

/**
 * Update last interaction timestamp (called when user logs an interaction)
 */
export async function updateLastInteractionTimestamp(): Promise<void> {
  try {
    await AsyncStorage.setItem('@weave:last_interaction', Date.now().toString());
  } catch (error) {
    console.error('[Analytics] Failed to update last interaction timestamp:', error);
  }
}

/**
 * Reset analytics (for testing or user opt-out)
 */
export async function resetAnalytics(): Promise<void> {
  try {
    if (posthogInstance) {
      posthogInstance.reset();
    }
    await AsyncStorage.removeItem('@weave:user_id');
    await AsyncStorage.removeItem('@weave:last_app_open');
    await AsyncStorage.removeItem('@weave:last_interaction');
    await AsyncStorage.removeItem('@weave:last_weekly_track');
    console.log('[Analytics] Analytics reset');
  } catch (error) {
    console.error('[Analytics] Failed to reset analytics:', error);
  }
}
