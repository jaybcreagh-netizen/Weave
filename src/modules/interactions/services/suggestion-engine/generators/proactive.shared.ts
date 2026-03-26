import type { Suggestion, Tier } from '@/shared/types/common';
import type { ProactiveSuggestion } from '@/modules/insights/types';
import type { Opportunity } from '../../opportunity-system/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProactiveBuildContext {
  friendId: string;
  friendName: string;
  friendTier?: Tier;
  currentScore: number;
  lastInteractionDate?: Date | null;
  now: Date;
}

function getProactiveId(proactive: ProactiveSuggestion): string {
  return `proactive-${proactive.type}-${proactive.friendId}`;
}

function getDaysSinceLastInteraction(lastInteractionDate?: Date | null, now: Date = new Date()): number | undefined {
  if (!lastInteractionDate) {
    return undefined;
  }

  return Math.max(0, Math.round((now.getTime() - lastInteractionDate.getTime()) / DAY_MS));
}

function getSuggestionIcon(type: ProactiveSuggestion['type']): string {
  switch (type) {
    case 'upcoming-drift':
      return 'TrendingDown';
    case 'optimal-timing':
      return 'Clock';
    case 'pattern-break':
      return 'AlertCircle';
    case 'momentum-opportunity':
      return 'Zap';
    case 'reciprocity-imbalance':
      return 'Scale';
    case 'best-day-scheduling':
      return 'Calendar';
    default:
      return 'Sparkles';
  }
}

function getOpportunityCategory(type: ProactiveSuggestion['type']): Opportunity['category'] {
  switch (type) {
    case 'upcoming-drift':
    case 'pattern-break':
      return 'high-drift';
    case 'momentum-opportunity':
      return 'momentum';
    case 'reciprocity-imbalance':
      return 'insight';
    case 'optimal-timing':
    case 'best-day-scheduling':
    default:
      return 'maintain';
  }
}

function getOpportunityUrgency(proactive: ProactiveSuggestion): number {
  const baseByUrgency: Record<ProactiveSuggestion['urgency'], number> = {
    critical: 92,
    high: 78,
    medium: 56,
    low: 34,
  };

  const typeModifier: Partial<Record<ProactiveSuggestion['type'], number>> = {
    'upcoming-drift': 4,
    'pattern-break': 6,
    'momentum-opportunity': 8,
    'best-day-scheduling': -4,
    'reciprocity-imbalance': -2,
  };

  return Math.max(0, Math.min(100, baseByUrgency[proactive.urgency] + (typeModifier[proactive.type] || 0)));
}

function getOpportunityConfidence(type: ProactiveSuggestion['type']): number {
  switch (type) {
    case 'upcoming-drift':
      return 0.82;
    case 'pattern-break':
      return 0.8;
    case 'momentum-opportunity':
      return 0.78;
    case 'optimal-timing':
      return 0.74;
    case 'best-day-scheduling':
      return 0.72;
    case 'reciprocity-imbalance':
    default:
      return 0.68;
  }
}

function getWhyThisFriend(proactive: ProactiveSuggestion): string {
  switch (proactive.type) {
    case 'upcoming-drift':
      return `${proactive.friendName} is approaching a likely drift point based on your current connection pattern.`;
    case 'optimal-timing':
      return `${proactive.friendName} is in a natural window for reconnecting based on your rhythm together.`;
    case 'pattern-break':
      return `Your usual rhythm with ${proactive.friendName} is slipping, which makes this relationship easier to miss.`;
    case 'momentum-opportunity':
      return `${proactive.friendName} is in a warm stretch right now, so follow-through is more likely to land well.`;
    case 'reciprocity-imbalance':
      return `The initiation balance with ${proactive.friendName} looks skewed right now.`;
    case 'best-day-scheduling':
    default:
      return `Your patterns suggest there is a more natural moment to connect with ${proactive.friendName}.`;
  }
}

function getWhyThisAction(proactive: ProactiveSuggestion): string {
  switch (proactive.type) {
    case 'upcoming-drift':
    case 'pattern-break':
      return 'Planning a touchpoint now is the best way to stop more distance from building.';
    case 'optimal-timing':
      return 'Using the natural timing window makes it easier to reconnect without forcing it.';
    case 'momentum-opportunity':
      return 'A quick follow-up can compound the momentum you already have.';
    case 'reciprocity-imbalance':
      return 'A small pause or intentional reach-out can reset the balance without overcorrecting.';
    case 'best-day-scheduling':
    default:
      return 'Choosing the strongest day makes follow-through feel lighter and more natural.';
  }
}

function getBestWindow(type: ProactiveSuggestion['type']): Opportunity['timeRelevance']['bestWindow'] {
  switch (type) {
    case 'momentum-opportunity':
      return 'afternoon';
    case 'reciprocity-imbalance':
      return 'evening';
    case 'best-day-scheduling':
      return 'morning';
    case 'upcoming-drift':
    case 'pattern-break':
    case 'optimal-timing':
    default:
      return 'midday';
  }
}

function getEffortLevel(type: ProactiveSuggestion['type']): Opportunity['effortLevel'] {
  switch (type) {
    case 'reciprocity-imbalance':
      return 'minimal';
    case 'momentum-opportunity':
    case 'upcoming-drift':
    case 'pattern-break':
    case 'optimal-timing':
    case 'best-day-scheduling':
    default:
      return 'moderate';
  }
}

export function buildProactiveSuggestion(
  proactive: ProactiveSuggestion,
  context: ProactiveBuildContext
): Suggestion {
  const daysSinceLastInteraction = getDaysSinceLastInteraction(context.lastInteractionDate, context.now);

  return {
    id: getProactiveId(proactive),
    friendId: proactive.friendId,
    friendName: proactive.friendName,
    urgency: proactive.urgency,
    category: proactive.type === 'reciprocity-imbalance' ? 'insight' : 'maintain',
    title: proactive.title,
    subtitle: proactive.message,
    actionLabel: proactive.type === 'reciprocity-imbalance' ? 'Consider' : 'Plan',
    icon: getSuggestionIcon(proactive.type),
    action: { type: 'plan' },
    dismissible: true,
    createdAt: context.now,
    type: proactive.type === 'momentum-opportunity' ? 'deepen' : 'connect',
    trackingContext: {
      friendScore: context.currentScore,
      daysSinceLastInteraction: daysSinceLastInteraction ?? 999,
    },
  };
}

export function buildProactiveOpportunity(
  proactive: ProactiveSuggestion,
  context: ProactiveBuildContext
): Opportunity {
  const daysSinceLastInteraction = getDaysSinceLastInteraction(context.lastInteractionDate, context.now);
  const deadlineAt = proactive.daysUntil > 0
    ? context.now.getTime() + (proactive.daysUntil * DAY_MS)
    : undefined;
  const effortLevel = getEffortLevel(proactive.type);
  const estimatedDurationMinutes = effortLevel === 'minimal' ? 10 : 30;

  return {
    id: getProactiveId(proactive),
    friendId: proactive.friendId,
    friendName: proactive.friendName,
    friendTier: context.friendTier,
    category: getOpportunityCategory(proactive.type),
    generatorSource: `proactive-${proactive.type}`,
    urgency: getOpportunityUrgency(proactive),
    confidence: getOpportunityConfidence(proactive.type),
    effortLevel,
    estimatedDurationMinutes,
    explanation: {
      whyNow: proactive.message,
      whyThisFriend: getWhyThisFriend(proactive),
      whyThisAction: getWhyThisAction(proactive),
    },
    timeRelevance: {
      bestWindow: getBestWindow(proactive.type),
      deadlineAt,
    },
    copyContext: {
      lastInteractionAt: context.lastInteractionDate?.getTime(),
      daysSinceLastInteraction,
      vibeHint: proactive.title,
    },
    createdAt: context.now.getTime(),
  };
}
