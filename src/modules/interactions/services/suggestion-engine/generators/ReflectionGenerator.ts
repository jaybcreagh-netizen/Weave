import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildReflectionSuggestion } from './reflection.shared';

export class ReflectionGenerator implements SuggestionGenerator {
    name = 'ReflectionGenerator';
    priority = 15; // Priority 3

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildReflectionSuggestion(context);
    }
}
