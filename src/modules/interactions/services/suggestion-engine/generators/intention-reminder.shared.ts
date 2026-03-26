import { differenceInDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import Intention from '@/db/models/Intention';
import type { Suggestion } from '@/shared/types/common';
import Logger from '@/shared/utils/Logger';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';
import { getCategoryLabel } from '../utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

function getIntentionReminderUrgency(daysSinceCreated: number): 'medium' | 'high' {
    return daysSinceCreated >= 14 ? 'high' : 'medium';
}

function buildIntentionCategoryHint(intention: Intention): string {
    return intention.interactionCategory
        ? ` (${getCategoryLabel(intention.interactionCategory)})`
        : '';
}

function buildIntentionReminderSubtitle(intention: Intention): string {
    const categoryHint = buildIntentionCategoryHint(intention);

    return intention.description
        ? `"${intention.description}"${categoryHint}`
        : `Complete your intention${categoryHint}`;
}

function buildWhyNow(intention: Intention, now: Date): string {
    const daysSinceCreated = differenceInDays(now, intention.createdAt);

    if (intention.description) {
        return `This intention has been waiting for ${daysSinceCreated} days: "${intention.description}".`;
    }

    return `This intention has been active for ${daysSinceCreated} days and is ready to become a real plan.`;
}

export async function findAgingIntentionReminder(
    friendId: string,
    now: Date
): Promise<Intention | null> {
    const today = now.getTime();
    const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);

    try {
        const intentionFriendsCollection = getOptionalQueryCollection<any>('intention_friends');
        const intentionsCollection = getOptionalQueryCollection<Intention>('intentions');

        if (!intentionFriendsCollection || !intentionsCollection) {
            return null;
        }

        const intentionFriends = await intentionFriendsCollection
            .query(Q.where('friend_id', friendId))
            .fetch();

        if (intentionFriends.length === 0) return null;

        const intentionIds = intentionFriends.map((ifriend: any) => ifriend._raw.intention_id);

        const agingIntentions = await intentionsCollection
            .query(
                Q.where('id', Q.oneOf(intentionIds)),
                Q.where('status', 'active'),
                Q.where('created_at', Q.lte(sevenDaysAgo)),
                Q.sortBy('created_at', Q.asc)
            )
            .fetch();

        return agingIntentions[0] || null;
    } catch (error) {
        Logger.error('Error checking aging intentions', error);
        return null;
    }
}

export function buildIntentionReminderSuggestion(
    context: SuggestionContext,
    intention: Intention
): Suggestion {
    const daysSinceCreated = differenceInDays(context.now, intention.createdAt);
    const urgency = getIntentionReminderUrgency(daysSinceCreated);

    return {
        id: `intention-reminder-${intention.id}`,
        friendId: context.friend.id,
        friendName: context.friend.name,
        urgency,
        category: 'maintain',
        title: `Intention for ${context.friend.name}`,
        subtitle: buildIntentionReminderSubtitle(intention),
        actionLabel: 'Schedule',
        icon: 'Target',
        action: {
            type: 'plan',
            prefilledCategory: intention.interactionCategory as any,
        },
        dismissible: true,
        createdAt: context.now,
        type: 'connect',
    };
}

export function buildIntentionReminderOpportunity(
    context: SuggestionContext,
    intention: Intention
): Opportunity {
    const daysSinceCreated = differenceInDays(context.now, intention.createdAt);
    const urgency = getIntentionReminderUrgency(daysSinceCreated);

    return {
        id: `intention-reminder-${intention.id}`,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'intention-reminder',
        generatorSource: 'intention-generator',
        urgency: urgency === 'high' ? 82 : 64,
        confidence: 0.88,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 30,
        explanation: {
            whyNow: buildWhyNow(intention, context.now),
            whyThisFriend: `${context.friend.name} already has an active intention waiting for follow-through.`,
            whyThisAction: intention.interactionCategory
                ? `Schedule a ${getCategoryLabel(intention.interactionCategory).toLowerCase()} to make this intention real.`
                : 'Schedule a concrete plan so this intention turns into action.',
        },
        timeRelevance: {
            bestWindow: 'morning',
        },
        intentionId: intention.id,
        intentionBoost: urgency === 'high' ? 0.2 : 0.1,
        copyContext: {
            lastInteractionAt: context.lastInteractionDate?.getTime(),
            daysSinceLastInteraction: context.lastInteractionDate
                ? differenceInDays(context.now, context.lastInteractionDate)
                : undefined,
            recentInteractionCategory: intention.interactionCategory,
        },
        createdAt: context.now.getTime(),
    };
}
