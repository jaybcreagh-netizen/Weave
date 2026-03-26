import type { InteractionCategory, Suggestion } from '@/shared/types/common';
import type FriendModel from '@/db/models/Friend';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';
import { getAllLearnedEffectiveness } from '@/modules/insights';
import { getCategoryLabel, getSmartCategory } from '../utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

interface InsightDescriptor {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel: string;
  action: Suggestion['action'];
  suggestionType: Suggestion['type'];
  category: Opportunity['category'];
  generatorSource: string;
  urgency: NonNullable<Suggestion['urgency']>;
  urgencyScore: number;
  confidence: number;
  effortLevel: Opportunity['effortLevel'];
  estimatedDurationMinutes: number;
  bestWindow: Opportunity['timeRelevance']['bestWindow'];
  whyThisFriend: string;
  whyThisAction: string;
}

function getTierLabel(tier?: string): string {
  if (tier === 'InnerCircle') return 'Inner Circle';
  if (tier === 'CloseFriends') return 'Close Friends';
  return 'Community';
}

function buildArchetypeMismatchDescriptor(context: SuggestionContext): InsightDescriptor | null {
  const { friend, recentInteractions } = context;
  if (recentInteractions.length < 3) {
    return null;
  }

  const nowTime = context.now.getTime();
  const pastInteractions = recentInteractions.filter(interaction => {
    const interactionTime = interaction.interactionDate instanceof Date
      ? interaction.interactionDate.getTime()
      : new Date(interaction.interactionDate).getTime();
    return interactionTime <= nowTime;
  });

  if (pastInteractions.length < 3) {
    return null;
  }

  const lastThree = pastInteractions.slice(0, 3);
  const preferredCategory = getArchetypePreferredCategory(friend.archetype);
  const hasPreferred = lastThree.some(interaction => interaction.interactionCategory === preferredCategory);

  if (hasPreferred) {
    return null;
  }

  const categoryLabel = preferredCategory.replace('-', ' ');

  return {
    id: `archetype-mismatch-${friend.id}`,
    title: `Missing ${friend.name}'s depth`,
    subtitle: `${friend.archetype} values certain types of connection. Your last 3 weaves didn't create space for that. Try ${categoryLabel}.`,
    icon: 'Lightbulb',
    actionLabel: 'Plan Deep Connection',
    action: {
      type: 'plan',
      prefilledCategory: preferredCategory as any,
    },
    suggestionType: 'reflect',
    category: 'archetype-mismatch',
    generatorSource: 'archetype-mismatch',
    urgency: 'medium',
    urgencyScore: 54,
    confidence: 0.82,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    bestWindow: 'evening',
    whyThisFriend: `${friend.name}'s archetype points to a kind of connection that has been missing lately.`,
    whyThisAction: 'Choosing a better-fit interaction style is more useful than simply doing more of the same.',
  };
}

function buildTierMismatchDescriptor(context: SuggestionContext): InsightDescriptor | null {
  const { friend } = context;
  const friendModel = friend as unknown as FriendModel;

  if (
    friendModel.tierFitScore !== undefined
    && friendModel.tierFitScore < 0.4
    && friendModel.suggestedTier
    && friendModel.suggestedTier !== friend.dunbarTier
    && !friendModel.tierSuggestionDismissedAt
  ) {
    const currentTierLabel = getTierLabel(friend.dunbarTier);
    const suggestedTierLabel = getTierLabel(friendModel.suggestedTier);
    const isPromotion = (
      (friend.dunbarTier === 'Community' && friendModel.suggestedTier !== 'Community')
      || (friend.dunbarTier === 'CloseFriends' && friendModel.suggestedTier === 'InnerCircle')
    );
    const subtitle = isPromotion
      ? `Your natural rhythm with ${friend.name} matches ${suggestedTierLabel}. Ready to promote?`
      : `Your interaction pattern with ${friend.name} suggests ${suggestedTierLabel} might fit better than ${currentTierLabel}.`;

    return {
      id: `tier-mismatch-${friend.id}`,
      title: `Tier check: ${friend.name}`,
      subtitle,
      icon: 'Layers',
      actionLabel: 'Review Tier',
      action: { type: 'tier-review' as any },
      suggestionType: 'reflect',
      category: 'insight',
      generatorSource: 'tier-mismatch',
      urgency: 'low',
      urgencyScore: 28,
      confidence: 0.78,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      bestWindow: 'morning',
      whyThisFriend: `${friend.name}'s observed interaction rhythm is mismatched with their current tier.`,
      whyThisAction: 'A tier review can make your expectations match the relationship you actually have.',
    };
  }

  return null;
}

function buildEffectivenessInsightDescriptor(context: SuggestionContext): InsightDescriptor | null {
  const { friend, currentScore } = context;
  const friendModel = friend as unknown as FriendModel;
  const effectivenessData = getSmartCategory(friend, 5);

  if (!effectivenessData.isLearned || currentScore < 50 || currentScore > 80) {
    return null;
  }

  const effectiveness = getAllLearnedEffectiveness(friendModel);
  const bestCategory = effectivenessData.category as InteractionCategory;
  const bestRatio = effectiveness[bestCategory] || 1;

  if (bestRatio < 1.3) {
    return null;
  }

  const percentBetter = Math.round((bestRatio - 1) * 100);
  const categoryLabel = getCategoryLabel(bestCategory);

  return {
    id: `effectiveness-insight-${friend.id}`,
    title: `What works with ${friend.name}`,
    subtitle: `${categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)}s are ${percentBetter}% more effective with ${friend.name}. Try scheduling one!`,
    icon: 'TrendingUp',
    actionLabel: 'Plan',
    action: {
      type: 'plan',
      prefilledCategory: bestCategory as any,
    },
    suggestionType: 'connect',
    category: 'insight',
    generatorSource: 'effectiveness-insight',
    urgency: 'low',
    urgencyScore: 34,
    confidence: Math.min(0.92, 0.7 + ((friendModel.outcomeCount || 0) / 50)),
    effortLevel: 'moderate',
    estimatedDurationMinutes: 20,
    bestWindow: 'afternoon',
    whyThisFriend: `You have enough outcome data with ${friend.name} to see a meaningful pattern.`,
    whyThisAction: 'Using the interaction type that already works best is the easiest way to improve follow-through.',
  };
}

function buildDescriptor(context: SuggestionContext): InsightDescriptor | null {
  return (
    buildArchetypeMismatchDescriptor(context)
    || buildTierMismatchDescriptor(context)
    || buildEffectivenessInsightDescriptor(context)
  );
}

export function buildInsightSuggestion(context: SuggestionContext): Suggestion | null {
  const descriptor = buildDescriptor(context);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    friendId: context.friend.id,
    friendName: context.friend.name,
    urgency: descriptor.urgency,
    category: descriptor.category,
    title: descriptor.title,
    subtitle: descriptor.subtitle,
    actionLabel: descriptor.actionLabel,
    icon: descriptor.icon,
    action: descriptor.action,
    dismissible: true,
    createdAt: context.now,
    type: descriptor.suggestionType,
  };
}

export function buildInsightOpportunity(context: SuggestionContext): Opportunity | null {
  const descriptor = buildDescriptor(context);
  if (!descriptor) {
    return null;
  }

  return {
    id: descriptor.id,
    friendId: context.friend.id,
    friendName: context.friend.name,
    friendTier: context.friend.dunbarTier,
    category: descriptor.category,
    generatorSource: descriptor.generatorSource,
    urgency: descriptor.urgencyScore,
    confidence: descriptor.confidence,
    effortLevel: descriptor.effortLevel,
    estimatedDurationMinutes: descriptor.estimatedDurationMinutes,
    explanation: {
      whyNow: descriptor.subtitle,
      whyThisFriend: descriptor.whyThisFriend,
      whyThisAction: descriptor.whyThisAction,
    },
    timeRelevance: {
      bestWindow: descriptor.bestWindow,
    },
    copyContext: {
      recentInteractionCategory: descriptor.action.prefilledCategory,
    },
    createdAt: context.now.getTime(),
  };
}
