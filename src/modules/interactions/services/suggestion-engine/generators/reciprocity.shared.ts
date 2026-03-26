import type { Suggestion } from '@/shared/types/common';
import type FriendModel from '@/db/models/Friend';
import { getSmartCategory } from '../utils';
import { getContextualSuggestion } from '../contextual-utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

interface ReciprocityDescriptor {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  icon: string;
  action: Suggestion['action'];
  suggestionType: Suggestion['type'];
  urgency: NonNullable<Suggestion['urgency']>;
  urgencyScore: number;
  category: Opportunity['category'];
  generatorSource: string;
  effortLevel: Opportunity['effortLevel'];
  estimatedDurationMinutes: number;
  confidence: number;
  bestWindow: Opportunity['timeRelevance']['bestWindow'];
  whyThisFriend: string;
  whyThisAction: string;
}

function buildDescriptor(context: SuggestionContext): ReciprocityDescriptor | null {
  const { friend, recentInteractions } = context;
  const friendModel = friend as unknown as FriendModel;

  if (friendModel.initiationRatio !== undefined && friendModel.initiationRatio > 0.75) {
    const totalInteractions = (friendModel.totalUserInitiations || 0) + (friendModel.totalFriendInitiations || 0);

    if (totalInteractions >= 5) {
      const consecutive = friendModel.consecutiveUserInitiations || 0;
      const urgency: 'low' | 'medium' = consecutive >= 4 ? 'medium' : 'low';
      const subtitle = consecutive >= 4
        ? `You've initiated ${consecutive} times in a row. Give ${friend.name} space to reach out.`
        : `You've driven ${Math.round(friendModel.initiationRatio * 100)}% of interactions. Let them initiate next.`;

      return {
        id: `reciprocity-imbalance-${friend.id}`,
        title: `Rebalance with ${friend.name}`,
        subtitle,
        actionLabel: 'Pause & Wait',
        icon: 'Scale',
        action: { type: 'reflect' },
        suggestionType: 'reflect',
        urgency,
        urgencyScore: urgency === 'medium' ? 50 : 32,
        category: 'insight',
        generatorSource: 'reciprocity-imbalance',
        effortLevel: 'minimal',
        estimatedDurationMinutes: 10,
        confidence: Math.min(0.9, 0.65 + (totalInteractions / 40)),
        bestWindow: 'evening',
        whyThisFriend: `${friend.name} has had a lopsided initiation pattern recently.`,
        whyThisAction: 'A brief pause gives the relationship room to rebalance naturally.',
      };
    }
  }

  if (friendModel.initiationRatio !== undefined && friendModel.initiationRatio < 0.25) {
    const totalInteractions = (friendModel.totalUserInitiations || 0) + (friendModel.totalFriendInitiations || 0);

    if (totalInteractions >= 5 && friend.dunbarTier !== 'Community') {
      const contextualAction = getContextualSuggestion(
        recentInteractions,
        friend.archetype,
        friend.dunbarTier,
        undefined,
        friend
      );
      const prefilledCategory = getSmartCategory(friend).category as any;

      return {
        id: `reciprocity-invest-${friend.id}`,
        title: `Invest more in ${friend.name}`,
        subtitle: `${friend.name} usually reaches out first. Show you value them. ${contextualAction}`,
        actionLabel: 'Reach Out',
        icon: 'Heart',
        action: {
          type: 'log',
          prefilledCategory,
        },
        suggestionType: 'connect',
        urgency: 'medium',
        urgencyScore: 58,
        category: 'insight',
        generatorSource: 'reciprocity-invest',
        effortLevel: 'minimal',
        estimatedDurationMinutes: 10,
        confidence: Math.min(0.9, 0.68 + (totalInteractions / 35)),
        bestWindow: 'midday',
        whyThisFriend: `${friend.name} is carrying more of the initiation load than you are.`,
        whyThisAction: 'A small proactive reach-out is the cleanest way to restore reciprocity.',
      };
    }
  }

  return null;
}

export function buildReciprocitySuggestion(context: SuggestionContext): Suggestion | null {
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

export function buildReciprocityOpportunity(context: SuggestionContext): Opportunity | null {
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
