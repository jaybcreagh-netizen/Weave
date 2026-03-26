import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildMaintenanceSuggestion } from './maintenance.shared';

export class MaintenanceGenerator implements SuggestionGenerator {
    name = 'MaintenanceGenerator';
    priority = 35; // Priority 7 and 4b (First Weave)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        return buildMaintenanceSuggestion(context);
    }
}
