import type { Suggestion, SuggestionSignalContext, Tier } from '@/shared/types/common';
import type { Opportunity } from '../../opportunity-system/types';
import { normalizeSuggestionCategory } from '../../opportunity-system/types';

const URGENCY_TO_SCORE: Record<NonNullable<Suggestion['urgency']>, number> = {
  critical: 92,
  high: 76,
  medium: 52,
  low: 28,
};

interface SignalOpportunityBuildOptions {
  friendTier?: Tier;
}

function getSignalCategory(
  suggestion: Suggestion,
  signalContext?: SuggestionSignalContext
): Opportunity['category'] | null {
  const normalized = normalizeSuggestionCategory(suggestion.category);
  if (
    normalized === 'signal-followup'
    || normalized === 'signal-repair'
    || normalized === 'signal-values'
    || normalized === 'signal-reconnect'
  ) {
    return normalized;
  }

  switch (signalContext?.type) {
    case 'follow-up':
      return 'signal-followup';
    case 'repair':
      return 'signal-repair';
    case 'values-match':
    case 'deepen':
      return 'signal-values';
    case 'reconnection':
      return 'signal-reconnect';
    default:
      return null;
  }
}

function getSignalUrgencyScore(suggestion: Suggestion, category: Opportunity['category']): number {
  const base = suggestion.urgency ? URGENCY_TO_SCORE[suggestion.urgency] : 50;

  switch (category) {
    case 'signal-followup':
      return Math.min(100, base + 4);
    case 'signal-repair':
      return Math.min(100, base + 6);
    case 'signal-values':
      return Math.max(0, base - 6);
    case 'signal-reconnect':
      return Math.min(100, base + 2);
    default:
      return base;
  }
}

function getSignalConfidence(category: Opportunity['category']): number {
  switch (category) {
    case 'signal-followup':
      return 0.84;
    case 'signal-repair':
      return 0.78;
    case 'signal-values':
      return 0.74;
    case 'signal-reconnect':
      return 0.76;
    default:
      return 0.7;
  }
}

function getSignalEffortLevel(category: Opportunity['category']): Opportunity['effortLevel'] {
  switch (category) {
    case 'signal-values':
      return 'moderate';
    case 'signal-followup':
    case 'signal-repair':
    case 'signal-reconnect':
    default:
      return 'minimal';
  }
}

function getSignalBestWindow(category: Opportunity['category']): Opportunity['timeRelevance']['bestWindow'] {
  switch (category) {
    case 'signal-values':
      return 'afternoon';
    case 'signal-followup':
    case 'signal-repair':
    case 'signal-reconnect':
    default:
      return 'evening';
  }
}

function getWhyThisFriend(
  suggestion: Suggestion,
  category: Opportunity['category'],
  signalContext?: SuggestionSignalContext
): string {
  const friendName = suggestion.friendName || 'this friend';
  const topic = signalContext?.topic;

  switch (category) {
    case 'signal-followup':
      return topic
        ? `${friendName} has an active thread around "${topic}" that is ready for a follow-up.`
        : `${friendName} has a relationship thread that looks ready for a follow-up.`;
    case 'signal-repair':
      return `${friendName} is linked to a recent tension signal from your journal reflections.`;
    case 'signal-values':
      return topic
        ? `You and ${friendName} seem aligned around "${topic}" right now.`
        : `${friendName} appears especially aligned with what matters to you right now.`;
    case 'signal-reconnect':
      return `${friendName} is showing reconnection-friendly signals in your recent reflections.`;
    default:
      return suggestion.contextSnippet || `There is a timely relationship signal connected to ${friendName}.`;
  }
}

function getWhyThisAction(category: Opportunity['category']): string {
  switch (category) {
    case 'signal-followup':
      return 'A light check-in is the easiest way to act while this thread is still warm.';
    case 'signal-repair':
      return 'A careful reach-out can lower the risk of more distance building after tension.';
    case 'signal-values':
      return 'Planning around shared values makes the connection feel more natural and meaningful.';
    case 'signal-reconnect':
      return 'A simple reach-out can turn a good reconnection window into real momentum.';
    default:
      return 'A small timely action is the best way to respond to this signal.';
  }
}

export function buildSignalDrivenOpportunity(
  suggestion: Suggestion,
  options: SignalOpportunityBuildOptions = {}
): Opportunity | null {
  const category = getSignalCategory(suggestion, suggestion.signalContext);
  if (!category) {
    return null;
  }

  const effortLevel = getSignalEffortLevel(category);
  const estimatedDurationMinutes = effortLevel === 'moderate' ? 30 : 10;
  const createdAt = suggestion.createdAt instanceof Date
    ? suggestion.createdAt.getTime()
    : suggestion.createdAt
      ? new Date(suggestion.createdAt).getTime()
      : Date.now();

  return {
    id: suggestion.id,
    friendId: suggestion.friendId,
    friendName: suggestion.friendName,
    friendTier: options.friendTier,
    category,
    generatorSource: category,
    urgency: getSignalUrgencyScore(suggestion, category),
    confidence: getSignalConfidence(category),
    effortLevel,
    estimatedDurationMinutes,
    explanation: {
      whyNow: suggestion.subtitle,
      whyThisFriend: getWhyThisFriend(suggestion, category, suggestion.signalContext),
      whyThisAction: getWhyThisAction(category),
    },
    timeRelevance: {
      bestWindow: getSignalBestWindow(category),
      expiresAt: suggestion.expiresAt ? suggestion.expiresAt.getTime() : undefined,
    },
    copyContext: {
      daysSinceLastInteraction: suggestion.trackingContext?.daysSinceLastInteraction,
      vibeHint: suggestion.signalContext?.topic,
      topInterest: category === 'signal-values' ? suggestion.signalContext?.topic : undefined,
    },
    createdAt,
  };
}
