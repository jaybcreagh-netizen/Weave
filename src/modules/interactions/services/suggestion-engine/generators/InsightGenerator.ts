import { Suggestion, InteractionCategory } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getSmartCategory, getCategoryLabel } from '../utils';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';
import FriendModel from '@/db/models/Friend';
import { getAllLearnedEffectiveness } from '@/modules/insights';

export class InsightGenerator implements SuggestionGenerator {
    name = 'InsightGenerator';
    priority = 60; // Priority 5 (mismatch), 12, 13

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, recentInteractions, currentScore, now } = context;
        const friendModel = friend as unknown as FriendModel;

        // PRIORITY 5: Archetype mismatch insight
        // Moved here to group insights together, although originally it had higher priority.
        // In waterfall logic, order matters. If we want this to be Priority 5, we might need a separate generator 
        // or ensure this check happens before others if passing all generators in one list.
        // For now, let's keep it here, but ideally we split it if strict priority is needed.
        // However, since we return early, we can check it first inside this generate method.

        // NOTE: This actually violates the strict "one generator per responsibility" if I mix priorities widely.
        // But grouping "Insights" is conceptually clean. 
        // Let's implement Mismatch first as it was Priority 5 in original code.
        const mismatch = this.checkArchetypeMismatch(friend, recentInteractions, now);
        if (mismatch) return mismatch;

        // PRIORITY 12: Tier fit mismatch suggestion
        if (friendModel.tierFitScore !== undefined &&
            friendModel.tierFitScore < 0.4 &&
            friendModel.suggestedTier &&
            friendModel.suggestedTier !== friend.dunbarTier &&
            !friendModel.tierSuggestionDismissedAt) {

            const currentTierLabel = friend.dunbarTier === 'InnerCircle' ? 'Inner Circle' :
                friend.dunbarTier === 'CloseFriends' ? 'Close Friends' : 'Community';
            const suggestedTierLabel = friendModel.suggestedTier === 'InnerCircle' ? 'Inner Circle' :
                friendModel.suggestedTier === 'CloseFriends' ? 'Close Friends' : 'Community';

            const isPromotion = (friend.dunbarTier === 'Community' && friendModel.suggestedTier !== 'Community') ||
                (friend.dunbarTier === 'CloseFriends' && friendModel.suggestedTier === 'InnerCircle');

            const subtitle = isPromotion
                ? `Your natural rhythm with ${friend.name} matches ${suggestedTierLabel}. Ready to promote?`
                : `Your interaction pattern with ${friend.name} suggests ${suggestedTierLabel} might fit better.`;

            return {
                id: `tier-mismatch-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency: 'low',
                category: 'insight',
                title: `Tier check: ${friend.name}`,
                subtitle,
                actionLabel: 'Review Tier',
                icon: 'Layers',
                action: { type: 'tier-review' as any },
                dismissible: true,
                createdAt: now,
                type: 'reflect',
            };
        }

        // PRIORITY 13: Effectiveness insight
        const effectivenessData = getSmartCategory(friend, 5);
        if (effectivenessData.isLearned && currentScore >= 50 && currentScore <= 80) {
            const effectiveness = getAllLearnedEffectiveness(friendModel);
            const bestCategory = effectivenessData.category;
            const bestRatio = effectiveness[bestCategory as InteractionCategory] || 1;

            if (bestRatio >= 1.3) {
                const percentBetter = Math.round((bestRatio - 1) * 100);
                const categoryLabel = getCategoryLabel(bestCategory);

                return {
                    id: `effectiveness-insight-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'low',
                    category: 'insight',
                    title: `What works with ${friend.name}`,
                    subtitle: `${categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)}s are ${percentBetter}% more effective with ${friend.name}. Try scheduling one!`,
                    actionLabel: 'Plan',
                    icon: 'TrendingUp',
                    action: {
                        type: 'plan',
                        prefilledCategory: bestCategory as any,
                    },
                    dismissible: true,
                    createdAt: now,
                    type: 'connect',
                };
            }
        }

        return null;
    }

    private checkArchetypeMismatch(
        friend: SuggestionContext['friend'],
        recentInteractions: SuggestionContext['recentInteractions'],
        now: Date
    ): Suggestion | null {
        if (recentInteractions.length < 3) return null;

        const nowTime = now.getTime();
        const pastInteractions = recentInteractions.filter(i => i.interactionDate && (i.interactionDate instanceof Date ? i.interactionDate.getTime() : new Date(i.interactionDate).getTime()) <= nowTime);

        if (pastInteractions.length < 3) return null;

        const last3 = pastInteractions.slice(0, 3);
        const preferredCategory = getArchetypePreferredCategory(friend.archetype);

        const hasPreferred = last3.some(i => i.interactionCategory === preferredCategory);

        if (!hasPreferred) {
            const categoryLabel = preferredCategory.replace('-', ' ');
            return {
                id: `archetype-mismatch-${friend.id}`,
                friendId: friend.id,
                friendName: friend.name,
                type: 'reflect',
                urgency: 'medium',
                category: 'insight',
                title: `Missing ${friend.name}'s depth`,
                subtitle: `${friend.archetype} values certain types of connection. Your last 3 weaves didn't create space for that. Try ${categoryLabel}.`,
                actionLabel: 'Plan Deep Connection',
                icon: '💡',
                action: {
                    type: 'plan',
                    prefilledCategory: preferredCategory as any,
                },
                dismissible: true,
                createdAt: now,
            };
        }

        return null;
    }
}
