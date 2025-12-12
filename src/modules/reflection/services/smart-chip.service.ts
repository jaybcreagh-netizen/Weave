import { STORY_CHIPS, StoryChip } from './story-chips.service';
import { analyzeText } from '../utils/text-analysis';

/**
 * Smart Chip Service
 * automatically suggests chips based on text content (notes)
 */

export class SmartChipService {
  /**
   * Suggest chips based on the content of a note
   * @param note The text content to analyze
   * @param limit Max number of suggestions to return
   * @returns Array of suggested StoryChips, sorted by relevance
   */
  static suggestChipsFromNote(note: string, limit: number = 5): StoryChip[] {
    if (!note || note.trim().length === 0) {
      return [];
    }

    const themes = analyzeText(note);
    const scoredChips: { chip: StoryChip; score: number }[] = [];

    // Score each chip based on how well it matches the detected themes
    STORY_CHIPS.forEach(chip => {
      if (!chip.keywords || chip.keywords.length === 0) return;

      let score = 0;

      // Check keyword matches against detected themes
      chip.keywords.forEach(keyword => {
        // Direct emotion match
        if (themes.emotions.includes(keyword)) score += 10;

        // Direct activity match
        if (themes.activities.includes(keyword)) score += 10;

        // Direct topic match
        if (themes.topics.includes(keyword)) score += 10;

        // Sentiment match (looser correlation)
        if (keyword === 'positive' && themes.sentiment === 'positive') score += 2;
        if (keyword === 'negative' && themes.sentiment === 'negative') score += 2;
        if (keyword === 'mixed' && themes.sentiment === 'mixed') score += 2;

        // Intensity match
        if (keyword === 'deep' && themes.intensity !== 'low') score += 3;
      });

      // Boost specific high-value matches
      if (themes.emotions.includes('laughter') && chip.id.includes('laugh')) score += 15;

      if (score > 0) {
        scoredChips.push({ chip, score });
      }
    });

    // Sort by score descending and return top N
    return scoredChips
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.chip);
  }

  /**
   * Check if a specific chip is highly relevant for the given text
   * Useful for "Did you mean...?" prompts
   */
  static isChipRelevant(chipId: string, text: string): boolean {
    const chip = STORY_CHIPS.find(c => c.id === chipId);
    if (!chip) return false;

    const suggestions = this.suggestChipsFromNote(text, 20);
    return suggestions.some(s => s.id === chipId);
  }
}
