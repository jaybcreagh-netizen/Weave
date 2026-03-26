import { Suggestion } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { buildHolidaySeasonSuggestion } from './holiday-season.shared';

/**
 * Priority levels for holiday suggestions:
 * - Holiday today: Priority 2.5 (after urgent life events, before intentions)
 * - Holiday tomorrow: Priority 4 (similar to upcoming plans)
 * - Holiday within lead time: Priority 8 (similar to deepen)
 */
export class HolidaySeasonGenerator implements SuggestionGenerator {
  name = 'HolidaySeasonGenerator';
  priority = 8; // Base priority, actual varies by urgency

  async generate(context: SuggestionContext): Promise<Suggestion | null> {
    return buildHolidaySeasonSuggestion(context);
  }
}
