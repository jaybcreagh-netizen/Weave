import { SuggestionContext, SuggestionGenerator } from '../types';
import { Suggestion } from '@/shared/types/common';
import { buildReciprocitySuggestion } from './reciprocity.shared';

export class ReciprocityGenerator implements SuggestionGenerator {
    name = 'ReciprocityGenerator';
    priority = 50; // Priority 10 & 11

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildReciprocitySuggestion(context);
    }
}
