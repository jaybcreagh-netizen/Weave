import type { InteractionCategory, Suggestion } from '@/shared/types/common';
import { getContextualSuggestion } from '../contextual-utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

const NOVELTY_POOL: InteractionCategory[] = [
  'hangout',
  'activity-hobby',
  'meal-drink',
  'deep-talk',
  'event-party',
];

function buildNoveltyCategory(context: SuggestionContext): InteractionCategory | null {
  if (context.currentScore <= 80) {
    return null;
  }

  const recentCategories = new Set(context.recentInteractions.map(interaction => interaction.interactionCategory));
  return NOVELTY_POOL.find(category => !recentCategories.has(category)) || null;
}

export function buildOptimizationSuggestion(context: SuggestionContext): Suggestion | null {
  const novelCategory = buildNoveltyCategory(context);
  if (!novelCategory) {
    return null;
  }

  const contextualAction = getContextualSuggestion(
    context.recentInteractions,
    context.friend.archetype,
    context.friend.dunbarTier,
    undefined,
    context.friend
  );

  return {
    id: `optimization-novelty-${context.friend.id}`,
    friendId: context.friend.id,
    friendName: context.friend.name,
    urgency: 'low',
    category: 'variety',
    title: `Try something new with ${context.friend.name}`,
    subtitle: `You're doing great! Why not switch it up? ${contextualAction}`,
    actionLabel: 'Plan',
    icon: 'Sparkles',
    action: {
      type: 'plan',
      prefilledCategory: novelCategory as any,
    },
    dismissible: true,
    createdAt: context.now,
    type: 'deepen',
  };
}

export function buildOptimizationOpportunity(context: SuggestionContext): Opportunity | null {
  const suggestion = buildOptimizationSuggestion(context);
  if (!suggestion) {
    return null;
  }

  return {
    id: suggestion.id,
    friendId: context.friend.id,
    friendName: context.friend.name,
    friendTier: context.friend.dunbarTier,
    category: 'variety',
    generatorSource: 'optimization-novelty',
    urgency: 30,
    confidence: 0.72,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    explanation: {
      whyNow: suggestion.subtitle,
      whyThisFriend: `${context.friend.name} is already in a healthy place, which makes novelty more valuable than maintenance.`,
      whyThisAction: 'A new interaction shape can keep a strong relationship from becoming repetitive.',
    },
    timeRelevance: {
      bestWindow: 'afternoon',
    },
    copyContext: {
      recentInteractionCategory: suggestion.action.prefilledCategory,
    },
    createdAt: context.now.getTime(),
  };
}
