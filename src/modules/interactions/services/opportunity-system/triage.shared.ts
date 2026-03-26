import type { Suggestion } from '@/shared/types/common';
import { adaptSuggestionsToOpportunities, opportunityToSuggestion } from './OpportunityAdapter';
import type { Opportunity } from './types';

const OVERWHELMED_CRITICAL_THRESHOLD = 5;
const VISIBLE_CRITICAL_LIMIT = 3;
const DRIFT_LIKE_CATEGORIES = new Set<Opportunity['category'] | string>([
  'critical-drift',
  'high-drift',
  'community-checkin',
  'drift',
]);

function isCriticalDriftOpportunity(opportunity: Opportunity): boolean {
  return opportunity.urgency >= 90
    && (opportunity.category === 'critical-drift' || opportunity.category === 'high-drift');
}

function isDriftLikeOpportunity(opportunity: Opportunity): boolean {
  return DRIFT_LIKE_CATEGORIES.has(opportunity.category);
}

export function buildTriageOpportunity(now: number = Date.now()): Opportunity {
  return {
    id: 'dormant-triage-info',
    friendId: 'system',
    friendName: 'Weave',
    category: 'gentle-nudge',
    generatorSource: 'triage-generator',
    urgency: 72,
    confidence: 0.95,
    effortLevel: 'minimal',
    estimatedDurationMinutes: 2,
    explanation: {
      whyNow: 'You have several urgent reconnection opportunities at once.',
      whyThisFriend: 'This is a system-level guide to help you restart without overwhelm.',
      whyThisAction: 'Narrowing the field to a few connections makes follow-through more realistic.',
    },
    timeRelevance: {
      bestWindow: 'morning',
    },
    presentationCopy: {
      title: 'Welcome back',
      subtitle: 'Focus on these few connections to get back into the flow.',
      actionLabel: 'Okay',
      reason: 'You have several urgent reconnections at once.',
      aiEnriched: false,
    },
    suggestionPayload: {
      type: 'connect',
      icon: 'Sun',
      dismissible: true,
      action: { type: 'connect' },
    },
    createdAt: now,
  };
}

export function applyOpportunityTriage(
  opportunities: Opportunity[],
  now: number = Date.now()
): Opportunity[] {
  const criticalDrifts = opportunities.filter(isCriticalDriftOpportunity);
  const isOverwhelmed = criticalDrifts.length >= OVERWHELMED_CRITICAL_THRESHOLD;

  if (!isOverwhelmed) {
    return opportunities;
  }

  const visibleCriticals = criticalDrifts.slice(0, VISIBLE_CRITICAL_LIMIT);
  const nonDriftOthers = opportunities.filter(opportunity => {
    if (visibleCriticals.some(critical => critical.id === opportunity.id)) {
      return false;
    }

    return !isDriftLikeOpportunity(opportunity);
  });

  const triageOpportunity = opportunities.find(opportunity => opportunity.id === 'dormant-triage-info')
    || buildTriageOpportunity(now);

  return [triageOpportunity, ...visibleCriticals, ...nonDriftOthers];
}

export function applySuggestionTriage(
  suggestions: Suggestion[],
  now: number = Date.now()
): Suggestion[] {
  const suggestionsById = new Map(suggestions.map(suggestion => [suggestion.id, suggestion]));
  const triagedOpportunities = applyOpportunityTriage(
    adaptSuggestionsToOpportunities(suggestions),
    now
  );

  return triagedOpportunities.map(opportunity =>
    opportunityToSuggestion(opportunity, suggestionsById.get(opportunity.id) || null)
  );
}
