import { Suggestion } from '@/shared/types/common';
import { applySuggestionTriage } from '../../opportunity-system/triage.shared';

/**
 * TriageGenerator
 * Not a standard generator, but a post-processor that handles "Dormant" or "Overwhelmed" states.
 * If too many critical drift suggestions exist, it filters them and adds a system "Triage" suggestion.
 */
export class TriageGenerator {
    static async apply(suggestions: Suggestion[]): Promise<Suggestion[]> {
        return applySuggestionTriage(suggestions);
    }
}
