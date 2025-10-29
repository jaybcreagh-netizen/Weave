/**
 * TEMPORARY: Testing helper for time-based filtering
 *
 * To test different times of day:
 * 1. Import this in time-aware-filter.ts
 * 2. Replace `new Date()` with `getTestDate()`
 * 3. Change SIMULATED_HOUR below
 * 4. Reload app and check suggestions
 * 5. Delete this file when done testing
 */

// CHANGE THIS VALUE TO TEST DIFFERENT TIMES
export const SIMULATED_HOUR = 21; // 9pm - should show reflections

export function getTestDate(): Date {
  const date = new Date();
  date.setHours(SIMULATED_HOUR);
  return date;
}

// Expected behavior by hour:
// 6-10am: Planning suggestions prioritized
// 11am-1pm: All types shown
// 2-5pm: Planning still good
// 6-9pm: Reflections prioritized, planning reduced
// 10pm+: Only critical/expiring suggestions
