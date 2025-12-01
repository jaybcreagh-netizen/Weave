import { Suggestion } from '../types/common';

/**
 * Time-aware filtering for suggestions
 * Makes suggestions feel contextually appropriate based on time of day
 */

export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

/**
 * Gets the current time bucket
 */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Determines if a suggestion is appropriate for the current time
 */
export function isSuggestionTimeAppropriate(suggestion: Suggestion, timeOfDay?: TimeOfDay): boolean {
  const currentTime = timeOfDay || getTimeOfDay();

  // Critical suggestions always show (emergencies don't wait)
  if (suggestion.urgency === 'critical') {
    return true;
  }

  // Night time (10pm-6am): Only show critical or time-sensitive reflections
  if (currentTime === 'night') {
    // Allow reflection suggestions if they're about to expire
    if (suggestion.action.type === 'reflect' && suggestion.expiresAt) {
      const hoursUntilExpiry = (suggestion.expiresAt.getTime() - Date.now()) / 3600000;
      return hoursUntilExpiry < 6; // Show if expiring in next 6 hours
    }
    return false; // Skip all other suggestions at night
  }

  // Planning suggestions - best in morning/afternoon
  if (suggestion.action.type === 'plan') {
    if (currentTime === 'morning' || currentTime === 'midday' || currentTime === 'afternoon') {
      return true; // Prime planning time
    }
    if (currentTime === 'evening') {
      // Evening: only show high-urgency planning
      return suggestion.urgency === 'high';
    }
    return false;
  }

  // Reflection suggestions - best in evening
  if (suggestion.action.type === 'reflect') {
    if (currentTime === 'evening') {
      return true; // Prime reflection time
    }
    if (currentTime === 'morning' || currentTime === 'midday') {
      // Morning/midday: only show high-urgency reflections
      return suggestion.urgency === 'high';
    }
    // Afternoon: allow all reflections
    return true;
  }

  // Log/action suggestions - show during waking hours
  if (suggestion.action.type === 'log') {
    return true;
  }

  // Default: show during reasonable hours
  return true;
}

/**
 * Filters a list of suggestions to only include time-appropriate ones
 */
export function filterSuggestionsByTime(suggestions: Suggestion[]): Suggestion[] {
  const currentTime = getTimeOfDay();
  return suggestions.filter(s => isSuggestionTimeAppropriate(s, currentTime));
}

/**
 * Gets a user-friendly description of the current time context
 * Useful for showing why certain suggestions are being prioritized
 */
export function getTimeContextMessage(): string {
  const timeOfDay = getTimeOfDay();

  switch (timeOfDay) {
    case 'morning':
      return 'Good morning! Great time to plan your day.';
    case 'midday':
      return 'Quick check-ins work well now.';
    case 'afternoon':
      return 'Good time to schedule something for later.';
    case 'evening':
      return 'Evening - perfect for reflection.';
    case 'night':
      return 'Late night - showing only critical items.';
  }
}

/**
 * Boosts or reduces suggestion priority based on time appropriateness
 * Returns a multiplier (0.5 - 2.0) to adjust suggestion ranking
 */
export function getTimePriorityMultiplier(suggestion: Suggestion): number {
  const timeOfDay = getTimeOfDay();

  // Planning in morning = boost
  if (suggestion.action.type === 'plan' && timeOfDay === 'morning') {
    return 1.5;
  }

  // Reflection in evening = boost
  if (suggestion.action.type === 'reflect' && timeOfDay === 'evening') {
    return 1.5;
  }

  // Planning in evening = reduce (but not filter out)
  if (suggestion.action.type === 'plan' && timeOfDay === 'evening') {
    return 0.7;
  }

  // Reflection in morning = reduce slightly
  if (suggestion.action.type === 'reflect' && timeOfDay === 'morning') {
    return 0.8;
  }

  return 1.0; // No adjustment
}
