/**
 * Story Chip Aggregator
 * Extracts and aggregates story chips from a week's interactions
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import InteractionModel from '@/db/models/Interaction';
import { STORY_CHIPS, StoryChip } from './story-chips.service';

export interface WeekStoryChipSuggestion {
  chipId: string;
  count: number; // How many times it appears in week's weaves
  chip: StoryChip;
}

/**
 * Get story chip suggestions from the past week's interactions
 * Returns chips sorted by frequency
 */
export async function getWeeklyStoryChipSuggestions(): Promise<WeekStoryChipSuggestion[]> {
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  // Get completed interactions from past week
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.gte(weekAgo)),
      Q.where('status', 'completed')
    )
    .fetch();

  // Extract all story chips from interactions
  const chipCounts: Record<string, number> = {};

  interactions.forEach(interaction => {
    if (interaction.reflection?.chips) {
      interaction.reflection.chips.forEach((chip: { chipId: string }) => {
        chipCounts[chip.chipId] = (chipCounts[chip.chipId] || 0) + 1;
      });
    }
  });

  // Convert to suggestions array
  const suggestions: WeekStoryChipSuggestion[] = Object.entries(chipCounts)
    .map(([chipId, count]) => {
      const chip = STORY_CHIPS.find(c => c.id === chipId);
      if (!chip) return null;
      return { chipId, count, chip };
    })
    .filter((s): s is WeekStoryChipSuggestion => s !== null)
    .sort((a, b) => b.count - a.count); // Sort by frequency, descending

  return suggestions;
}

/**
 * Get top N story chip suggestions
 */
export async function getTopStoryChipSuggestions(limit: number = 6): Promise<WeekStoryChipSuggestion[]> {
  const suggestions = await getWeeklyStoryChipSuggestions();
  return suggestions.slice(0, limit);
}
