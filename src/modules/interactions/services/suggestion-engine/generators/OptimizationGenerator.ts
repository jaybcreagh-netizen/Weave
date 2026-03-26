import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildOptimizationSuggestion } from './optimization.shared';

export class OptimizationGenerator implements SuggestionGenerator {
    name = 'OptimizationGenerator';
    priority = 45; // Between Maintenance (35) and Reciprocity (50)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildOptimizationSuggestion(context);
    }
}
