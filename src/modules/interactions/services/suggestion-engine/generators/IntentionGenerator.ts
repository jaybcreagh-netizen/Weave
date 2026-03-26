import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import {
    buildIntentionReminderSuggestion,
    findAgingIntentionReminder,
} from './intention-reminder.shared';

export class IntentionGenerator implements SuggestionGenerator {
    name = 'IntentionGenerator';
    priority = 11; // Priority 2.5 (between 2 and 3)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, now } = context;

        const agingIntention = await findAgingIntentionReminder(friend.id, now);
        if (agingIntention) {
            return buildIntentionReminderSuggestion(context, agingIntention);
        }

        return null;
    }
}
