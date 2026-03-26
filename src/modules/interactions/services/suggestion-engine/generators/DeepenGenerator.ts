import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildDeepenSuggestion } from './deepen.shared';

export class DeepenGenerator implements SuggestionGenerator {
    name = 'DeepenGenerator';
    priority = 40; // Priority 8

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildDeepenSuggestion(context);
    }
}
