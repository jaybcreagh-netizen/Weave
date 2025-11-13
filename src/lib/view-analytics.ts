/**
 * TEMPORARY: View suggestion analytics in console and send to PostHog
 *
 * To test tracking:
 * 1. Import this in dashboard.tsx
 * 2. Call viewSuggestionAnalytics() in useEffect
 * 3. Check console for analytics and PostHog for event
 * 4. Delete this file when done
 */

import { getSuggestionAnalytics } from './suggestion-tracker';
import { trackEvent } from './analytics';

export async function viewSuggestionAnalytics() {
  try {
    const analytics = await getSuggestionAnalytics();
    console.log('[Analytics] Suggestion analytics:', analytics);
    // Send analytics data to PostHog
    trackEvent('suggestion_analytics_viewed', analytics);
  } catch (error) {
    console.error('[Analytics] Failed to view suggestion analytics:', error);
  }
}
