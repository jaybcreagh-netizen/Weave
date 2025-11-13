/**
 * TEMPORARY: View suggestion analytics in console
 *
 * To test tracking:
 * 1. Import this in dashboard.tsx
 * 2. Call viewSuggestionAnalytics() in useEffect
 * 3. Check console for analytics
 * 4. Delete this file when done
 */

import { getSuggestionAnalytics } from './suggestion-tracker';

export async function viewSuggestionAnalytics() {
  const analytics = await getSuggestionAnalytics();
  // Analytics ready but not logged to console
}
