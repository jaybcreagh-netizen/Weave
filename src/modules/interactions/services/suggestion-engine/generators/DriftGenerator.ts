import { SuggestionContext, SuggestionGenerator } from '../types';
import { Suggestion } from '@/shared/types/common';
import { buildDriftSuggestion } from './drift.shared';

export class DriftGenerator implements SuggestionGenerator {
    name = 'DriftGenerator';
    priority = 20; // Priorities 3, 4, 9

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildDriftSuggestion(context);
    }
}
