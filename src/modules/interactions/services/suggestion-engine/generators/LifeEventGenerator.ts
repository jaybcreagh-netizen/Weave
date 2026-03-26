import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildLifeEventSuggestion, findUpcomingLifeEvent } from './life-event.shared';

export class LifeEventGenerator implements SuggestionGenerator {
    name = 'LifeEventGenerator';
    priority = 10; // Priorities 2 (urgent) and 5 (upcoming)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, now } = context;
        const lifeEvent = await findUpcomingLifeEvent(friend, now);

        if (!lifeEvent) return null;

        return buildLifeEventSuggestion(context, lifeEvent);
    }
}
