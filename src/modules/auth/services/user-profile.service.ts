// src/modules/intelligence/services/user-profile.service.ts
import type UserProfile from '@/db/models/UserProfile';

export function getRecentBatteryAverage(userProfile: UserProfile, days: number = 7): number | null {
  const history = userProfile.socialBatteryHistory;
  if (history.length === 0) return null;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentEntries = history.filter(entry => entry.timestamp >= cutoff);

  if (recentEntries.length === 0) return null;

  const sum = recentEntries.reduce((acc, entry) => acc + entry.value, 0);
  return sum / recentEntries.length;
}

export function getBatteryTrend(userProfile: UserProfile): 'rising' | 'falling' | 'stable' | null {
  const history = userProfile.socialBatteryHistory;
  if (history.length < 3) return null;

  // Compare recent 3 vs previous 3
  const recent = history.slice(-3);
  const previous = history.slice(-6, -3);

  if (previous.length < 3) return null;

  const recentAvg = recent.reduce((sum, e) => sum + e.value, 0) / recent.length;
  const prevAvg = previous.reduce((sum, e) => sum + e.value, 0) / previous.length;

  const diff = recentAvg - prevAvg;

  if (diff > 0.5) return 'rising';
  if (diff < -0.5) return 'falling';
  return 'stable';
}
