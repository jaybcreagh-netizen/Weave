import { differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, format, isToday, isYesterday, isPast, startOfDay } from 'date-fns';

/**
 * Formats a date into poetic, human-readable language
 */
export const formatPoeticDate = (date: Date | string): {
  primary: string;    // Main time description
  secondary: string;  // Time of day
} => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const hoursAgo = differenceInHours(now, d);
  // Use startOfDay for calendar-day comparisons to avoid time-of-day issues
  // (e.g., 3 PM today vs 10 AM tomorrow is only 19 hours, but should be 1 day)
  const daysAgo = differenceInDays(startOfDay(now), startOfDay(d));
  const weeksAgo = differenceInWeeks(now, d);
  const monthsAgo = differenceInMonths(now, d);

  let primary = '';

  // Future dates
  if (hoursAgo < 0) {
    const daysUntil = Math.abs(daysAgo);
    if (daysUntil === 0) {
      primary = 'Later today';
    } else if (daysUntil === 1) {
      primary = 'Tomorrow';
    } else if (daysUntil < 7) {
      primary = format(d, 'EEEE'); // Day name
    } else {
      primary = format(d, 'MMM d');
    }
  }
  // Today
  else if (isToday(d)) {
    if (hoursAgo < 1) {
      primary = 'Just now';
    } else if (hoursAgo < 3) {
      primary = 'Earlier today';
    } else {
      primary = 'Today';
    }
  }
  // Yesterday
  else if (isYesterday(d)) {
    primary = 'Yesterday';
  }
  // This week (2-6 days ago)
  else if (daysAgo >= 2 && daysAgo <= 6) {
    primary = format(d, 'EEEE'); // "Monday", "Tuesday", etc.
  }
  // Last week (7-13 days ago)
  else if (daysAgo >= 7 && daysAgo <= 13) {
    primary = `Last ${format(d, 'EEEE')}`;
  }
  // This month
  else if (daysAgo < 30) {
    primary = `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
  }
  // Older
  else if (monthsAgo < 12) {
    primary = `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
  }
  // Over a year
  else {
    primary = format(d, 'MMM yyyy');
  }

  // Time of day
  const hour = d.getHours();
  let secondary = '';

  if (hour >= 5 && hour < 12) {
    secondary = 'Morning';
  } else if (hour >= 12 && hour < 17) {
    secondary = 'Afternoon';
  } else if (hour >= 17 && hour < 21) {
    secondary = 'Evening';
  } else {
    secondary = 'Night';
  }

  return { primary, secondary };
};

/**
 * Calculate "warmth" intensity based on recency (0.0 - 1.0)
 * Used for thread color, glow, and animation intensity
 */
export const calculateWeaveWarmth = (date: Date | string): number => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const hoursAgo = differenceInHours(now, d);

  // Future weaves have no warmth (they're ethereal)
  if (hoursAgo < 0) return 0;

  // Today: Full warmth (1.0)
  if (hoursAgo < 24) {
    return 1.0;
  }

  // This week: High warmth (0.7)
  if (hoursAgo < 168) { // 7 days
    return 0.7;
  }

  // This month: Medium warmth (0.4)
  if (hoursAgo < 720) { // 30 days
    return 0.4;
  }

  // Older: Low warmth (0.2)
  return 0.2;
};

/**
 * Get section title based on time category
 */
export const getPoeticSectionTitle = (category: 'future' | 'today' | 'past'): string => {
  switch (category) {
    case 'future':
      return 'Seeds Planted';
    case 'today':
      return "Today's Thread";
    case 'past':
      return 'Woven Memories';
    default:
      return '';
  }
};

/**
 * Interpolate between two colors based on a factor (0-1)
 */
export const interpolateColor = (color1: string, color2: string, factor: number): string => {
  // Simple rgba interpolation for our use case
  // Assumes colors are in rgba format
  const c1 = color1.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
  const c2 = color2.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];

  const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
  const a = (c1[3] + (c2[3] - c1[3]) * factor).toFixed(2);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Get thread and knot colors based on warmth
 */
export const getThreadColors = (warmth: number, isFuture: boolean = false) => {
  if (isFuture) {
    return {
      thread: 'rgba(181, 138, 108, 0.3)',
      knot: 'rgba(181, 138, 108, 0.4)',
      glow: 'transparent',
    };
  }

  const warmColors = {
    thread: 'rgba(181, 138, 108, 1)',
    knot: '#D4AF37',
    glow: 'rgba(212, 175, 55, 0.6)',
  };

  const coolColors = {
    thread: 'rgba(181, 138, 108, 0.3)',
    knot: 'rgba(181, 138, 108, 0.5)',
    glow: 'transparent',
  };

  return {
    thread: interpolateColor(coolColors.thread, warmColors.thread, warmth),
    knot: interpolateColor(coolColors.knot, warmColors.knot, warmth),
    glow: interpolateColor(coolColors.glow, warmColors.glow, warmth),
  };
};

/**
 * Calculate the next recommended connection date based on Dunbar tier
 */
export const calculateNextConnectionDate = (lastInteractionDate: Date, tier: string): Date => {
  const intervalDays: { [key: string]: number } = {
    InnerCircle: 7,    // Weekly
    CloseFriends: 14,  // Bi-weekly
    Community: 30,     // Monthly
  };

  const days = intervalDays[tier] || 30;
  const nextDate = new Date(lastInteractionDate);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

/**
 * Calculate overall connection status (used elsewhere in the app)
 */
export type ConnectionStatus = 'healthy' | 'stable' | 'attention';

export const calculateOverallStatus = (interactions: any[], tier: string): ConnectionStatus => {
  if (!interactions || interactions.length === 0) {
    return 'attention';
  }

  const now = new Date();
  const pastInteractions = interactions.filter(i => isPast(new Date(i.interactionDate)));

  if (pastInteractions.length === 0) {
    return 'attention';
  }

  const mostRecent = pastInteractions.reduce((latest, current) => {
    return new Date(current.interactionDate) > new Date(latest.interactionDate) ? current : latest;
  });

  const daysSinceLastInteraction = differenceInDays(now, new Date(mostRecent.interactionDate));

  const thresholds: { [key: string]: { attention: number; stable: number } } = {
    InnerCircle: { attention: 10, stable: 5 },
    CloseFriends: { attention: 20, stable: 10 },
    Community: { attention: 40, stable: 20 },
  };

  const threshold = thresholds[tier] || thresholds.Community;

  if (daysSinceLastInteraction > threshold.attention) {
    return 'attention';
  } else if (daysSinceLastInteraction > threshold.stable) {
    return 'stable';
  } else {
    return 'healthy';
  }
};