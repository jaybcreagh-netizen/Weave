import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry Error Monitoring Configuration
 *
 * To enable:
 * 1. Create a free account at https://sentry.io
 * 2. Create a new React Native project
 * 3. Copy your DSN and replace SENTRY_DSN below
 * 4. Deploy and monitor errors in real-time
 */

const SENTRY_DSN = ''; // TODO: Add your Sentry DSN here

export function initializeSentry() {
  // Skip initialization if no DSN is configured
  if (!SENTRY_DSN) {
    console.log('[Sentry] Skipped - No DSN configured');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Enable in production, disable in development for cleaner logs
    enabled: !__DEV__,

    // Capture console errors automatically
    enableAutoSessionTracking: true,

    // Session tracking for crash-free rate metrics
    sessionTrackingIntervalMillis: 30000, // 30 seconds

    // Performance monitoring
    tracesSampleRate: __DEV__ ? 0 : 0.2, // 20% of transactions in production

    // Release tracking
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Constants.expoConfig?.android?.versionCode?.toString() ||
          Constants.expoConfig?.ios?.buildNumber ||
          '1',

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Breadcrumbs for debugging context
    maxBreadcrumbs: 50,

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events in development
      if (__DEV__) {
        console.log('[Sentry] Event captured (dev mode - not sending):', event);
        return null;
      }

      // Filter out sensitive user data
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      return event;
    },

    // Ignore common React Native warnings
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'Warning: Each child in a list should have a unique "key" prop',
      // Add more patterns as needed
    ],
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (__DEV__) {
    console.error('[Sentry] Exception (dev mode - not sending):', error, context);
    return;
  }

  if (context) {
    Sentry.setContext('additional', context);
  }

  Sentry.captureException(error);
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (__DEV__) {
    console.log(`[Sentry] Message [${level}] (dev mode - not sending):`, message);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context (call this after user logs in or identifies)
 */
export function setUser(userId: string, metadata?: Record<string, any>) {
  Sentry.setUser({
    id: userId,
    ...metadata,
  });
}

/**
 * Clear user context (call on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

export default Sentry;
