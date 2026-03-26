import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildMomentumSuggestion } from './momentum.shared';

export class MomentumGenerator implements SuggestionGenerator {
    name = 'MomentumGenerator';
    priority = 30; // Priority 6

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildMomentumSuggestion(context);
    }
}
