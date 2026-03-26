import type { Suggestion } from '@/shared/types/common';
import type { Opportunity, OpportunityPresentationCopy } from './types';
import type { CopyExperimentVariant } from './SelectorExperimentService';

export const OPPORTUNITY_PRESENTATION_COPY_VERSION = 1;

const INTERACTION_LABELS: Record<string, string> = {
  'text-call': 'chat',
  'voice-note': 'voice note',
  'meal-drink': 'meal',
  'hangout': 'hangout',
  'deep-talk': 'deep conversation',
  'activity-hobby': 'activity',
  'event-party': 'event',
  'favor-support': 'supportive check-in',
  'celebration': 'celebration',
};

interface OpportunityCopyInput {
  opportunity: Opportunity;
  action: Suggestion['action'];
  baseTitle: string;
  baseSubtitle: string;
  baseActionLabel?: string;
  baseContextSnippet?: string;
  copyVariant?: CopyExperimentVariant;
}

export interface OpportunityCopyOutput extends OpportunityPresentationCopy {
  reason: string;
  aiEnriched: true;
}

function truncate(text: string, maxLength: number = 170): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function toSentence(value?: string | null): string {
  if (!value) return '';

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function joinSentences(...parts: Array<string | undefined | null>): string {
  return truncate(parts
    .map(part => toSentence(part))
    .filter(Boolean)
    .join(' '));
}

function getDaysPhrase(days?: number): string | null {
  if (typeof days !== 'number' || Number.isNaN(days) || days < 0) {
    return null;
  }

  if (days === 0) return 'You connected today';
  if (days === 1) return 'You last connected yesterday';
  return `It has been ${days} days since you last connected`;
}

function getInteractionLabel(category?: string): string | null {
  if (!category) return null;
  return INTERACTION_LABELS[category] || null;
}

function getTopicHint(opportunity: Opportunity): string | null {
  return opportunity.copyContext?.topInterest
    || opportunity.copyContext?.vibeHint
    || opportunity.copyContext?.locationHint
    || null;
}

function getSpecificTitle(opportunity: Opportunity, fallbackTitle: string): string {
  const friendName = opportunity.friendName || 'them';
  const daysSince = opportunity.copyContext?.daysSinceLastInteraction;
  const interactionLabel = getInteractionLabel(opportunity.copyContext?.recentInteractionCategory);
  const topicHint = getTopicHint(opportunity);

  switch (opportunity.category) {
    case 'signal-followup':
      return topicHint
        ? `Follow up with ${friendName} on ${topicHint}`
        : fallbackTitle;
    case 'signal-repair':
      return `Repair the thread with ${friendName}`;
    case 'signal-values':
      return topicHint
        ? `Make deeper time with ${friendName} around ${topicHint}`
        : `Make deeper time with ${friendName}`;
    case 'signal-reconnect':
      return topicHint
        ? `Reopen the ${topicHint} thread with ${friendName}`
        : `Reopen the thread with ${friendName}`;
    case 'intention-reminder':
      return interactionLabel
        ? `Plan that ${interactionLabel} with ${friendName}`
        : `Turn your intention with ${friendName} into a plan`;
    case 'critical-drift':
      return typeof daysSince === 'number' && daysSince >= 7
        ? `Reach out to ${friendName} after ${daysSince} quiet days`
        : `Reconnect with ${friendName}`;
    case 'high-drift':
      return typeof daysSince === 'number' && daysSince >= 10
        ? `Reconnect with ${friendName} before more drift`
        : `Reconnect with ${friendName}`;
    case 'momentum':
      return interactionLabel
        ? `Build on your last ${interactionLabel} with ${friendName}`
        : `Keep the momentum with ${friendName}`;
    case 'deepen':
      return topicHint
        ? `Go deeper with ${friendName} around ${topicHint}`
        : `Deepen things with ${friendName}`;
    case 'maintain':
      return topicHint
        ? `Make time for ${friendName} around ${topicHint}`
        : fallbackTitle;
    default:
      return fallbackTitle;
  }
}

function getSpecificSubtitle(opportunity: Opportunity, fallbackSubtitle: string): string {
  const friendName = opportunity.friendName || 'them';
  const interactionLabel = getInteractionLabel(opportunity.copyContext?.recentInteractionCategory);
  const topicHint = getTopicHint(opportunity);
  const daysPhrase = getDaysPhrase(opportunity.copyContext?.daysSinceLastInteraction);

  switch (opportunity.category) {
    case 'signal-followup':
      return topicHint
        ? `A light follow-up on ${topicHint} will feel timely.`
        : fallbackSubtitle;
    case 'signal-values':
      return topicHint
        ? `${friendName} feels especially aligned around ${topicHint} right now.`
        : fallbackSubtitle;
    case 'intention-reminder':
      return interactionLabel
        ? `This intention is ready to become a real ${interactionLabel}.`
        : 'This intention is ready to become a real plan.';
    case 'critical-drift':
    case 'high-drift':
      return daysPhrase ? `${daysPhrase}.` : fallbackSubtitle;
    default:
      return fallbackSubtitle;
  }
}

function getSpecificContextSnippet(
  opportunity: Opportunity,
  fallbackContextSnippet?: string
): string | undefined {
  const friendName = opportunity.friendName || 'them';
  const topicHint = getTopicHint(opportunity);
  const interactionLabel = getInteractionLabel(opportunity.copyContext?.recentInteractionCategory);
  const daysPhrase = getDaysPhrase(opportunity.copyContext?.daysSinceLastInteraction);
  const whyThisAction = opportunity.explanation.whyThisAction;

  switch (opportunity.category) {
    case 'signal-followup':
      if (topicHint) {
        return joinSentences(
          `The "${topicHint}" thread is still warm with ${friendName}`,
          whyThisAction
        );
      }
      break;
    case 'signal-values':
      if (topicHint) {
        return joinSentences(
          `${friendName} feels aligned around ${topicHint} right now`,
          whyThisAction
        );
      }
      break;
    case 'signal-reconnect':
      if (topicHint) {
        return joinSentences(
          `"${topicHint}" gives you a natural way back in with ${friendName}`,
          whyThisAction
        );
      }
      break;
    case 'intention-reminder':
      return joinSentences(
        interactionLabel
          ? `You already meant to make a ${interactionLabel} happen with ${friendName}`
          : `You already set an intention for ${friendName}`,
        whyThisAction
      );
    case 'critical-drift':
    case 'high-drift':
    case 'community-checkin':
      if (daysPhrase) {
        return joinSentences(daysPhrase, whyThisAction);
      }
      break;
    case 'momentum':
      return joinSentences(
        interactionLabel
          ? `Your last ${interactionLabel} with ${friendName} still has warmth behind it`
          : opportunity.explanation.whyThisFriend,
        whyThisAction
      );
    case 'maintain':
    case 'deepen':
      if (topicHint) {
        return joinSentences(
          `${topicHint} is a natural way to make this feel specific with ${friendName}`,
          whyThisAction
        );
      }
      break;
    default:
      break;
  }

  if (fallbackContextSnippet) {
    return truncate(fallbackContextSnippet);
  }

  if (daysPhrase) {
    return joinSentences(daysPhrase, whyThisAction);
  }

  return truncate(opportunity.explanation.whyThisFriend);
}

function getSpecificActionLabel(
  opportunity: Opportunity,
  action: Suggestion['action'],
  fallbackActionLabel?: string
): string | undefined {
  switch (opportunity.category) {
    case 'signal-followup':
      return 'Follow Up';
    case 'signal-repair':
      return 'Reach Gently';
    case 'signal-reconnect':
      return 'Reach Out';
    case 'signal-values':
      return action.type === 'plan' ? 'Plan It' : fallbackActionLabel;
    case 'intention-reminder':
      return 'Make a Plan';
    case 'life-event':
      return action.type === 'plan' ? 'Plan Ahead' : 'Reach Out';
    case 'momentum':
      return action.type === 'plan' ? 'Keep It Going' : fallbackActionLabel;
    default:
      return fallbackActionLabel;
  }
}

export function enrichOpportunityCopy({
  opportunity,
  action,
  baseTitle,
  baseSubtitle,
  baseActionLabel,
  baseContextSnippet,
  copyVariant = 'control',
}: OpportunityCopyInput): OpportunityCopyOutput {
  const title = truncate(getSpecificTitle(opportunity, baseTitle), copyVariant === 'concise' ? 72 : 80);
  const defaultSubtitle = truncate(getSpecificSubtitle(opportunity, baseSubtitle), 140);
  const defaultContextSnippet = getSpecificContextSnippet(opportunity, baseContextSnippet);
  const actionLabel = getSpecificActionLabel(opportunity, action, baseActionLabel);
  let subtitle = defaultSubtitle;
  let contextSnippet = defaultContextSnippet;

  if (copyVariant === 'concise') {
    subtitle = truncate(opportunity.explanation.whyNow || defaultSubtitle, 96);
    contextSnippet = opportunity.explanation.whyThisAction
      ? truncate(opportunity.explanation.whyThisAction, 96)
      : undefined;
  } else if (copyVariant === 'why-now') {
    subtitle = truncate(opportunity.explanation.whyNow || defaultSubtitle, 120);
    contextSnippet = joinSentences(
      opportunity.explanation.whyNow,
      opportunity.explanation.whyThisAction
    );
  }

  return {
    title,
    subtitle,
    contextSnippet,
    actionLabel,
    reason: contextSnippet || subtitle,
    aiEnriched: true,
  };
}
