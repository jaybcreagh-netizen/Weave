import type { InteractionCategory, Suggestion } from '@/shared/types/common';

const VALID_INTERACTION_CATEGORIES: Set<InteractionCategory> = new Set([
  'text-call',
  'voice-note',
  'meal-drink',
  'hangout',
  'deep-talk',
  'event-party',
  'activity-hobby',
  'favor-support',
  'celebration',
]);

const CATEGORY_FALLBACKS: Record<string, InteractionCategory> = {
  // Drift / reconnect families
  drift: 'text-call',
  'high-drift': 'text-call',
  'critical-drift': 'text-call',
  'community-checkin': 'text-call',
  'signal-reconnect': 'text-call',

  // Relationship maintenance / deepen families
  maintain: 'hangout',
  deepen: 'deep-talk',
  celebrate: 'celebration',
  'life-event': 'celebration',
  seasonal: 'hangout',
  variety: 'activity-hobby',

  // Insight / reflection families
  insight: 'deep-talk',
  reflect: 'deep-talk',
  'daily-reflect': 'deep-talk',
  'signal-followup': 'text-call',
  'signal-repair': 'deep-talk',
  'signal-values': 'deep-talk',

  // System/meta
  'gentle-nudge': 'text-call',
  wildcard: 'text-call',
  portfolio: 'hangout',
  'set-intention': 'hangout',
  plan: 'hangout',
};

export function isValidInteractionCategory(value: unknown): value is InteractionCategory {
  return typeof value === 'string' && VALID_INTERACTION_CATEGORIES.has(value as InteractionCategory);
}

/**
 * Resolve the most reliable interaction category for action flows (plan/log/reflect).
 * Priority:
 * 1) explicit suggestion.action.prefilledCategory
 * 2) mapped suggestion.category fallback
 * 3) provided default fallback
 */
export function resolveSuggestionInteractionCategory(
  suggestion: Pick<Suggestion, 'action' | 'category'>,
  defaultCategory: InteractionCategory = 'hangout'
): InteractionCategory {
  const prefilledCategory = suggestion.action?.prefilledCategory;
  if (isValidInteractionCategory(prefilledCategory)) {
    return prefilledCategory;
  }

  if (suggestion.category && CATEGORY_FALLBACKS[suggestion.category]) {
    return CATEGORY_FALLBACKS[suggestion.category];
  }

  return defaultCategory;
}
