import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildPlannedWeaveSuggestion } from './planned-weave.shared';

export class PlannedWeaveGenerator implements SuggestionGenerator {
    name = 'PlannedWeaveGenerator';
    priority = 5; // Priorities 1 (past due) and 4 (upcoming)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildPlannedWeaveSuggestion(context);
    }
}
