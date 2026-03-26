import type { Suggestion, Tier } from '@/shared/types/common';
import type { Opportunity, SelectionResult } from './types';
import { normalizeSuggestionCategory } from './types';
import { enrichOpportunityCopy } from './OpportunityCopyEnricher';
import type { CopyExperimentVariant } from './SelectorExperimentService';

const MINUTES_BY_EFFORT = {
  minimal: 10,
  moderate: 30,
  high: 60,
} as const;

const TYPE_CATEGORY_FALLBACK: Record<Suggestion['type'], Opportunity['category']> = {
  connect: 'maintain',
  deepen: 'deepen',
  reconnect: 'high-drift',
  celebrate: 'celebrate',
  reflect: 'reflect',
};

const URGENCY_TO_SCORE: Record<NonNullable<Suggestion['urgency']>, number> = {
  critical: 95,
  high: 75,
  medium: 50,
  low: 25,
};

export interface SuggestionOpportunityOptions {
  friendTier?: Tier;
  generatorSource?: string;
}

export interface AdaptedSuggestionSelection {
  primary: Suggestion | null;
  secondary: Suggestion | null;
  reason: SelectionResult['reason'];
}

export interface OpportunityAdapterOptions {
  copyVariant?: CopyExperimentVariant;
}

function getOpportunityUrgency(urgencyScore: number): NonNullable<Suggestion['urgency']> {
  if (urgencyScore >= 90) return 'critical';
  if (urgencyScore >= 70) return 'high';
  if (urgencyScore >= 45) return 'medium';
  return 'low';
}

function getOpportunityType(opportunity: Opportunity): Suggestion['type'] {
  if (
    opportunity.generatorSource === 'portfolio-tier-imbalance'
    || opportunity.generatorSource === 'portfolio-inner-mixed'
  ) {
    return 'reconnect';
  }

  if (opportunity.generatorSource === 'portfolio-inner-crisis') {
    return 'deepen';
  }

  if (opportunity.generatorSource === 'portfolio-thriving') {
    return 'celebrate';
  }

  if (
    opportunity.generatorSource === 'reciprocity-imbalance'
    || opportunity.generatorSource === 'tier-mismatch'
    || opportunity.generatorSource === 'archetype-mismatch'
  ) {
    return 'reflect';
  }

  if (opportunity.generatorSource === 'optimization-novelty') {
    return 'deepen';
  }

  if (opportunity.generatorSource.startsWith('holiday-') && opportunity.category === 'celebrate') {
    return 'celebrate';
  }

  switch (opportunity.category) {
    case 'critical-drift':
    case 'high-drift':
    case 'signal-repair':
    case 'signal-reconnect':
      return 'reconnect';
    case 'deepen':
    case 'momentum':
    case 'signal-values':
      return 'deepen';
    case 'signal-followup':
      return 'connect';
    case 'life-event':
    case 'celebrate':
      return 'celebrate';
    case 'reflect':
    case 'daily-reflect':
      return 'reflect';
    default:
      return 'connect';
  }
}

function getDefaultPrefilledCategory(opportunity: Opportunity): string | undefined {
  if (opportunity.copyContext?.recentInteractionCategory) {
    return opportunity.copyContext.recentInteractionCategory;
  }

  switch (opportunity.category) {
    case 'life-event':
    case 'celebrate':
      return 'celebration';
    case 'deepen':
    case 'signal-values':
      return 'deep-talk';
    case 'momentum':
    case 'maintain':
    case 'first-weave':
    case 'community-checkin':
    case 'signal-followup':
    case 'signal-repair':
    case 'signal-reconnect':
      return 'text-call';
    case 'high-drift':
    case 'critical-drift':
      return opportunity.effortLevel === 'minimal' ? 'text-call' : 'hangout';
    default:
      return undefined;
  }
}

function getOpportunityAction(opportunity: Opportunity): Suggestion['action'] {
  if (opportunity.generatorSource === 'reciprocity-imbalance') {
    return { type: 'reflect' };
  }

  if (opportunity.generatorSource === 'reciprocity-invest') {
    return {
      type: 'log',
      prefilledCategory: getDefaultPrefilledCategory(opportunity),
    };
  }

  if (opportunity.generatorSource === 'tier-mismatch') {
    return { type: 'tier-review' as any };
  }

  if (opportunity.category === 'reflect' || opportunity.category === 'daily-reflect') {
    return { type: 'reflect' };
  }

  if (opportunity.category === 'portfolio' || opportunity.category === 'insight') {
    return { type: 'plan' };
  }

  const prefilledCategory = getDefaultPrefilledCategory(opportunity);

  if (opportunity.category === 'intention-reminder') {
    return {
      type: 'plan',
      prefilledCategory,
    };
  }

  if (opportunity.category === 'critical-drift') {
    return {
      type: 'log',
      prefilledCategory: prefilledCategory || 'text-call',
      prefilledMode: 'detailed',
    };
  }

  if (opportunity.category === 'life-event' || opportunity.category === 'celebrate') {
    return {
      type: opportunity.effortLevel === 'minimal' ? 'log' : 'plan',
      prefilledCategory: prefilledCategory || 'celebration',
    };
  }

  const actionType = opportunity.effortLevel === 'minimal' ? 'log' : 'plan';
  return {
    type: actionType,
    prefilledCategory,
  };
}

function getOpportunityIcon(opportunity: Opportunity): string {
  if (opportunity.generatorSource === 'weekly-reflection-generator') {
    return 'Book';
  }

  switch (opportunity.generatorSource) {
    case 'signal-followup':
      return 'MessageCircle';
    case 'signal-repair':
      return 'Heart';
    case 'signal-values':
      return 'Sparkles';
    case 'signal-reconnect':
      return 'RefreshCw';
    case 'proactive-upcoming-drift':
      return 'TrendingDown';
    case 'proactive-optimal-timing':
      return 'Clock';
    case 'proactive-pattern-break':
      return 'AlertCircle';
    case 'proactive-momentum-opportunity':
      return 'Zap';
    case 'proactive-reciprocity-imbalance':
      return 'Scale';
    case 'proactive-best-day-scheduling':
      return 'Calendar';
    case 'reciprocity-imbalance':
      return 'Scale';
    case 'reciprocity-invest':
      return 'Heart';
    case 'archetype-mismatch':
      return 'Lightbulb';
    case 'tier-mismatch':
      return 'Layers';
    case 'effectiveness-insight':
      return 'TrendingUp';
    case 'optimization-novelty':
      return 'Sparkles';
    case 'holiday-christmas':
    case 'holiday-christmas-eve':
    case 'holiday-new-years-day':
    case 'holiday-new-years-eve':
    case 'holiday-valentines-day':
    case 'holiday-galentines-day':
      return 'Gift';
    case 'portfolio-tier-imbalance':
      return 'BarChart3';
    case 'portfolio-inner-crisis':
      return 'AlertTriangle';
    case 'portfolio-inner-mixed':
      return 'Heart';
    case 'portfolio-thriving':
      return 'Sparkles';
    case 'portfolio-diversity':
      return 'RefreshCcw';
    default:
      break;
  }

  if (opportunity.generatorSource.startsWith('portfolio-archetype-neglect-')) {
    return 'Lightbulb';
  }

  if (opportunity.generatorSource.startsWith('holiday-')) {
    return opportunity.category === 'celebrate' ? 'Gift' : 'Calendar';
  }

  switch (opportunity.category) {
    case 'critical-drift':
    case 'high-drift':
      return 'Wind';
    case 'community-checkin':
      return 'Users';
    case 'intention-reminder':
      return 'Target';
    case 'life-event':
    case 'celebrate':
      return 'Gift';
    case 'reflect':
    case 'daily-reflect':
      return 'Moon';
    case 'momentum':
      return 'Zap';
    case 'deepen':
      return 'Sparkles';
    case 'maintain':
    case 'first-weave':
      return 'MessageCircle';
    case 'insight':
      return 'Scale';
    case 'portfolio':
      return 'BarChart3';
    default:
      return 'Sparkles';
  }
}

function getOpportunityTitle(opportunity: Opportunity): string {
  if (opportunity.generatorSource === 'weekly-reflection-generator') {
    return 'Sunday Reflection';
  }

  switch (opportunity.generatorSource) {
    case 'signal-followup':
      return `Check in on ${opportunity.friendName || 'them'}`;
    case 'signal-repair':
      return `Reconnect with ${opportunity.friendName || 'them'}`;
    case 'signal-values':
      return `Quality time with ${opportunity.friendName || 'them'}`;
    case 'signal-reconnect':
      return `Perfect timing for ${opportunity.friendName || 'them'}`;
    case 'proactive-upcoming-drift':
      return `${opportunity.friendName || 'Someone'} will need attention soon`;
    case 'proactive-optimal-timing':
      return `Perfect time to connect with ${opportunity.friendName || 'them'}`;
    case 'proactive-pattern-break':
      return `Breaking your pattern with ${opportunity.friendName || 'them'}`;
    case 'proactive-momentum-opportunity':
      return `Ride the momentum with ${opportunity.friendName || 'them'}`;
    case 'proactive-reciprocity-imbalance':
      return `Check the balance with ${opportunity.friendName || 'them'}`;
    case 'proactive-best-day-scheduling':
      return `Plan your best day with ${opportunity.friendName || 'them'}`;
    case 'reciprocity-imbalance':
      return `Rebalance with ${opportunity.friendName || 'them'}`;
    case 'reciprocity-invest':
      return `Invest more in ${opportunity.friendName || 'them'}`;
    case 'archetype-mismatch':
      return `Missing ${opportunity.friendName || 'their'} depth`;
    case 'tier-mismatch':
      return `Tier check: ${opportunity.friendName || 'this relationship'}`;
    case 'effectiveness-insight':
      return `What works with ${opportunity.friendName || 'them'}`;
    case 'optimization-novelty':
      return `Try something new with ${opportunity.friendName || 'them'}`;
    default:
      break;
  }

  if (opportunity.generatorSource.startsWith('holiday-')) {
    const holidayName = opportunity.copyContext?.vibeHint || 'Holiday';
    return `${holidayName} connection with ${opportunity.friendName || 'them'}`;
  }

  switch (opportunity.generatorSource) {
    case 'portfolio-tier-imbalance':
      return 'Close Friends need attention';
    case 'portfolio-inner-crisis':
      return 'Inner Circle needs care';
    case 'portfolio-inner-mixed':
      return 'Some Inner Circle members need attention';
    case 'portfolio-thriving':
      return 'Your weave is thriving!';
    case 'portfolio-diversity':
      return 'Broaden your connection circle';
    default:
      break;
  }

  if (opportunity.generatorSource.startsWith('portfolio-archetype-neglect-')) {
    return 'An archetype feels distant';
  }

  const friendName = opportunity.friendName || 'someone';

  switch (opportunity.category) {
    case 'critical-drift':
    case 'high-drift':
      return `Reconnect with ${friendName}`;
    case 'community-checkin':
      return `Check in with ${friendName}`;
    case 'intention-reminder':
      return `Intention for ${friendName}`;
    case 'life-event':
      return `${friendName} has something coming up`;
    case 'reflect':
    case 'daily-reflect':
      return opportunity.friendName
        ? `Reflect on ${friendName}`
        : 'Take a moment to reflect';
    case 'deepen':
      return `Deepen things with ${friendName}`;
    case 'momentum':
      return `Build momentum with ${friendName}`;
    case 'first-weave':
      return `Reach out to ${friendName}`;
    case 'celebrate':
      return `Celebrate ${friendName}`;
    case 'insight':
      return `Check the balance with ${friendName}`;
    case 'portfolio':
      return 'Review your network';
    default:
      return `Check in with ${friendName}`;
  }
}

function getOpportunityActionLabel(opportunity: Opportunity, action: Suggestion['action']): string {
  if (opportunity.category === 'intention-reminder') return 'Schedule';
  if (opportunity.category === 'reflect' || opportunity.category === 'daily-reflect') return 'Reflect';
  if (opportunity.category === 'critical-drift') return 'Reach Out';
  if (opportunity.category === 'community-checkin') return 'Reach Out';
  if (opportunity.generatorSource === 'reciprocity-imbalance') return 'Pause & Wait';
  if (opportunity.generatorSource === 'reciprocity-invest') return 'Reach Out';
  if (opportunity.generatorSource === 'tier-mismatch') return 'Review Tier';
  if (opportunity.generatorSource === 'archetype-mismatch') return 'Plan Deep Connection';
  if (opportunity.generatorSource.startsWith('holiday-') && action.type === 'log') return 'Reach Out';
  if (opportunity.category === 'portfolio') return 'Review';
  if (opportunity.category === 'insight') return 'Consider';
  if (opportunity.generatorSource === 'proactive-momentum-opportunity') return 'Deepen';
  if (action.type === 'plan') return 'Plan';
  if (action.type === 'log') return 'Reach Out';
  return 'View';
}

function getOpportunityReason(opportunity: Opportunity): string {
  return opportunity.explanation.whyNow;
}

export function opportunityToSuggestion(
  opportunity: Opportunity,
  existingSuggestion?: Suggestion | null,
  options: OpportunityAdapterOptions = {}
): Suggestion {
  const action = existingSuggestion?.action
    || opportunity.suggestionPayload?.action
    || getOpportunityAction(opportunity);
  const urgency = getOpportunityUrgency(opportunity.urgency);
  const daysSinceLastInteraction = opportunity.copyContext?.daysSinceLastInteraction;
  const trackingContext = opportunity.friendId && daysSinceLastInteraction !== undefined
    ? {
        friendScore: opportunity.urgency,
        daysSinceLastInteraction,
      }
    : existingSuggestion?.trackingContext || opportunity.suggestionPayload?.trackingContext;
  const fallbackTitle = existingSuggestion?.title || getOpportunityTitle(opportunity);
  const fallbackSubtitle = existingSuggestion?.subtitle || opportunity.explanation.whyNow;
  const fallbackActionLabel = existingSuggestion?.actionLabel || getOpportunityActionLabel(opportunity, action);
  const enrichedCopy = enrichOpportunityCopy({
    opportunity,
    action,
    baseTitle: fallbackTitle,
    baseSubtitle: fallbackSubtitle,
    baseActionLabel: fallbackActionLabel,
    baseContextSnippet: opportunity.presentationCopy?.contextSnippet || existingSuggestion?.contextSnippet,
    copyVariant: options.copyVariant,
  });
  const presentationCopy = {
    ...enrichedCopy,
    ...opportunity.presentationCopy,
  };

  return {
    id: opportunity.id,
    type: existingSuggestion?.type || opportunity.suggestionPayload?.type || getOpportunityType(opportunity),
    friendId: existingSuggestion?.friendId || opportunity.friendId || '',
    friendName: opportunity.friendName || existingSuggestion?.friendName,
    title: presentationCopy.title,
    subtitle: existingSuggestion?.subtitle || presentationCopy.subtitle,
    icon: existingSuggestion?.icon || opportunity.suggestionPayload?.icon || getOpportunityIcon(opportunity),
    score: existingSuggestion?.score ?? Math.round(opportunity.confidence * 100),
    reason: presentationCopy.reason || existingSuggestion?.reason || getOpportunityReason(opportunity),
    priority: existingSuggestion?.priority || (urgency === 'critical' || urgency === 'high' ? 'high' : urgency),
    action,
    category: opportunity.category,
    urgency,
    expiresAt: existingSuggestion?.expiresAt || (
      opportunity.timeRelevance.expiresAt
        ? new Date(opportunity.timeRelevance.expiresAt)
        : opportunity.timeRelevance.deadlineAt
          ? new Date(opportunity.timeRelevance.deadlineAt)
          : undefined
    ),
    actionLabel: presentationCopy.actionLabel || fallbackActionLabel,
    dismissible: existingSuggestion?.dismissible
      ?? opportunity.suggestionPayload?.dismissible
      ?? (opportunity.category !== 'critical-drift'),
    createdAt: existingSuggestion?.createdAt || new Date(opportunity.createdAt),
    trackingContext,
    contextSnippet: presentationCopy.contextSnippet,
    aiEnriched: presentationCopy.aiEnriched ?? true,
    signalContext: existingSuggestion?.signalContext || opportunity.suggestionPayload?.signalContext,
  };
}

function inferGeneratorSource(suggestion: Suggestion): string {
  if (suggestion.signalContext) return 'signal-driven';
  if (suggestion.category === 'portfolio' || suggestion.category === 'insight') return 'portfolio';
  if (suggestion.category === 'daily-reflect' || suggestion.type === 'reflect') return 'reflection';
  if (suggestion.category === 'life-event') return 'life-event';
  if (suggestion.category === 'wildcard') return 'fallback';
  return 'legacy-suggestion';
}

function inferEffortLevel(suggestion: Suggestion): Opportunity['effortLevel'] {
  if (suggestion.action.type === 'life-event' || suggestion.action.type === 'oracle') {
    return 'high';
  }

  if (
    suggestion.type === 'deepen'
    || suggestion.action.type === 'plan'
    || suggestion.action.type === 'intention'
    || suggestion.action.type === 'tier-review'
  ) {
    return 'moderate';
  }

  return 'minimal';
}

function inferBestWindow(suggestion: Suggestion): Opportunity['timeRelevance']['bestWindow'] {
  if (suggestion.action.type === 'reflect' || suggestion.action.type === 'oracle') {
    return 'evening';
  }

  if (suggestion.action.type === 'plan' || suggestion.action.type === 'intention') {
    return 'morning';
  }

  if (suggestion.category === 'life-event' || suggestion.type === 'celebrate') {
    return 'afternoon';
  }

  return 'midday';
}

function inferConfidence(suggestion: Suggestion): number {
  if (typeof suggestion.score === 'number') {
    const normalized = suggestion.score > 1 ? suggestion.score / 100 : suggestion.score;
    return Math.min(Math.max(normalized, 0), 1);
  }

  if (suggestion.urgency === 'critical') return 0.95;
  if (suggestion.urgency === 'high') return 0.8;
  if (suggestion.urgency === 'medium') return 0.65;
  return 0.5;
}

function inferUrgencyScore(suggestion: Suggestion): number {
  return URGENCY_TO_SCORE[suggestion.urgency || 'medium'];
}

function inferCategory(suggestion: Suggestion): Opportunity['category'] {
  return normalizeSuggestionCategory(suggestion.category)
    || TYPE_CATEGORY_FALLBACK[suggestion.type];
}

function buildExplanation(suggestion: Suggestion): Opportunity['explanation'] {
  const actionLabel = suggestion.actionLabel || suggestion.action.type;

  return {
    whyNow: suggestion.reason || suggestion.subtitle || suggestion.title,
    whyThisFriend: suggestion.friendName
      ? `${suggestion.friendName} is the focus of this opportunity.`
      : 'This is a broader relationship opportunity.',
    whyThisAction: `Best next step: ${actionLabel}.`,
  };
}

export function suggestionToOpportunity(
  suggestion: Suggestion,
  options: SuggestionOpportunityOptions = {}
): Opportunity {
  const effortLevel = inferEffortLevel(suggestion);
  const expiresAt = suggestion.expiresAt?.getTime();
  const createdAt = suggestion.createdAt?.getTime() || Date.now();

  return {
    id: suggestion.id,
    friendId: suggestion.friendId || undefined,
    friendName: suggestion.friendName,
    friendTier: options.friendTier,
    category: inferCategory(suggestion),
    generatorSource: options.generatorSource || inferGeneratorSource(suggestion),
    urgency: inferUrgencyScore(suggestion),
    confidence: inferConfidence(suggestion),
    effortLevel,
    estimatedDurationMinutes: MINUTES_BY_EFFORT[effortLevel],
    explanation: buildExplanation(suggestion),
    timeRelevance: {
      bestWindow: inferBestWindow(suggestion),
      deadlineAt: expiresAt,
      expiresAt,
    },
    copyContext: suggestion.trackingContext
      ? {
          daysSinceLastInteraction: suggestion.trackingContext.daysSinceLastInteraction,
          recentInteractionCategory: suggestion.action.prefilledCategory,
        }
      : undefined,
    suggestionPayload: {
      type: suggestion.type,
      icon: suggestion.icon,
      dismissible: suggestion.dismissible,
      action: suggestion.action,
      trackingContext: suggestion.trackingContext,
      signalContext: suggestion.signalContext,
    },
    createdAt,
  };
}

export function adaptSuggestionsToOpportunities(
  suggestions: Suggestion[],
  resolveOptions?: (suggestion: Suggestion) => SuggestionOpportunityOptions
): Opportunity[] {
  return suggestions.map(suggestion =>
    suggestionToOpportunity(suggestion, resolveOptions?.(suggestion))
  );
}

export function adaptSelectionToSuggestions(
  selection: SelectionResult,
  suggestions: Suggestion[],
  opportunities?: Opportunity[],
  options: OpportunityAdapterOptions = {}
): AdaptedSuggestionSelection {
  const suggestionsById = new Map(suggestions.map(suggestion => [suggestion.id, suggestion]));
  const opportunitiesById = new Map((opportunities || []).map(opportunity => [opportunity.id, opportunity]));

  const resolveSuggestion = (opportunity: SelectionResult['primary']) => {
    if (!opportunity) return null;
    return opportunityToSuggestion(
      opportunitiesById.get(opportunity.id) || opportunity,
      suggestionsById.get(opportunity.id) || null,
      options
    );
  };

  return {
    primary: resolveSuggestion(selection.primary),
    secondary: resolveSuggestion(selection.secondary),
    reason: selection.reason,
  };
}
