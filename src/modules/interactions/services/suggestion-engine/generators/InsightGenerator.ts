import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildInsightSuggestion } from './insight.shared';

export class InsightGenerator implements SuggestionGenerator {
    name = 'InsightGenerator';
    priority = 60; // Priority 5 (mismatch), 12, 13

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildInsightSuggestion(context);
    }
}
