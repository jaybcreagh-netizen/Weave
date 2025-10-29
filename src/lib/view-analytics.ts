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

  console.log('📊 SUGGESTION ANALYTICS:');
  console.log('========================');
  console.log(`Total shown: ${analytics.totalShown}`);
  console.log(`Total acted on: ${analytics.totalActed}`);
  console.log(`Total dismissed: ${analytics.totalDismissed}`);
  console.log(`Conversion rate: ${analytics.conversionRate}%`);
  console.log(`Avg time to action: ${analytics.avgTimeToActionMinutes} min`);
  console.log('\nBy Type:');
  Object.entries(analytics.byType).forEach(([type, stats]) => {
    console.log(`  ${type}: ${stats.acted}/${stats.shown} = ${stats.conversionRate}%`);
  });
}
