import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { getCategoryLabel } from '../utils';
import { database } from '@/db';
import Intention from '@/db/models/Intention';
import { Q } from '@nozbe/watermelondb';
import { differenceInDays } from 'date-fns';
import Logger from '@/shared/utils/Logger';

export class IntentionGenerator implements SuggestionGenerator {
    name = 'IntentionGenerator';
    priority = 11; // Priority 2.5 (between 2 and 3)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, now } = context;

        const agingIntention = await this.checkAgingIntention(friend, now);
        if (agingIntention) {
            const daysSinceCreated = differenceInDays(now, agingIntention.createdAt);

            let urgency: 'medium' | 'high' = 'medium';
            if (daysSinceCreated >= 14) urgency = 'high';

            const categoryHint = agingIntention.interactionCategory
                ? ` (${getCategoryLabel(agingIntention.interactionCategory)})`
                : '';

            const subtitle = agingIntention.description
                ? `"${agingIntention.description}"${categoryHint}`
                : `Complete your intention${categoryHint}`;

            return {
                id: `intention-reminder-${agingIntention.id}`,
                friendId: friend.id,
                friendName: friend.name,
                urgency,
                category: 'maintain',
                title: `Intention for ${friend.name}`,
                subtitle,
                actionLabel: 'Schedule',
                icon: 'Target',
                action: {
                    type: 'plan',
                    prefilledCategory: agingIntention.interactionCategory as any,
                },
                dismissible: true,
                createdAt: now,
                type: 'connect',
            };
        }

        return null;
    }

    private async checkAgingIntention(friend: SuggestionContext['friend'], now: Date): Promise<Intention | null> {
        const today = now.getTime();
        const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);

        try {
            const intentionFriends = await database
                .get('intention_friends')
                .query(Q.where('friend_id', friend.id))
                .fetch();

            if (intentionFriends.length === 0) return null;

            const intentionIds = intentionFriends.map((ifriend: any) => ifriend._raw.intention_id);

            const agingIntentions = await database
                .get<Intention>('intentions')
                .query(
                    Q.where('id', Q.oneOf(intentionIds)),
                    Q.where('status', 'active'),
                    Q.where('created_at', Q.lte(sevenDaysAgo)),
                    Q.sortBy('created_at', Q.asc)
                )
                .fetch();

            if (agingIntentions.length > 0) {
                return agingIntentions[0];
            }
        } catch (error) {
            Logger.error('Error checking aging intentions', error);
        }

        return null;
    }
}
