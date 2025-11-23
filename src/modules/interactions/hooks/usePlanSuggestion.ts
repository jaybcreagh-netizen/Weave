import { useState, useEffect } from 'react';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { type InteractionCategory } from '@/shared/types/common';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';

export interface PlanSuggestion {
  suggestedCategory?: InteractionCategory;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  recentLocations?: string[]; // For Phase 1 location history
}

/**
 * Intelligent hook that suggests what kind of connection to plan
 * based on interaction history, archetype, and relationship health
 */
export function usePlanSuggestion(friend: FriendModel | null): PlanSuggestion | null {
  const [suggestion, setSuggestion] = useState<PlanSuggestion | null>(null);

  useEffect(() => {
    if (!friend) {
      setSuggestion(null);
      return;
    }

    generateSuggestion(friend).then(setSuggestion);
  }, [friend?.id]);

  return suggestion;
}

async function generateSuggestion(friend: FriendModel): Promise<PlanSuggestion | null> {
  try {
    // Get past 90 days of completed interactions
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const allInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
        Q.sortBy('interaction_date', Q.desc)
      )
      .fetch();

    // Filter to this friend's interactions
    const friendInteractions: Interaction[] = [];
    const recentLocations: string[] = [];

    for (const interaction of allInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some(jf => jf.friendId === friend.id)) {
        friendInteractions.push(interaction);
        if (interaction.location) {
          recentLocations.push(interaction.location);
        }
      }
    }

    // Deduplicate locations
    const uniqueLocations = [...new Set(recentLocations)].slice(0, 3);

    // PRIORITY 1: Strong pattern (same category 3+ times in last 3 months)
    const categoryPattern = findStrongPattern(friendInteractions);
    if (categoryPattern) {
      return {
        suggestedCategory: categoryPattern.category,
        reason: `You've done this ${categoryPattern.count} times together`,
        confidence: 'high',
        recentLocations: uniqueLocations,
      };
    }

    // PRIORITY 2: High-vibe category (what worked well)
    const highVibe = findHighVibeCategory(friendInteractions);
    if (highVibe) {
      return {
        suggestedCategory: highVibe.category,
        reason: `${capitalize(highVibe.category)} went really well last time`,
        confidence: 'medium',
        recentLocations: uniqueLocations,
      };
    }

    // PRIORITY 3: Archetype preference (if no strong history)
    const archetypePreferred = getArchetypePreferredCategory(friend.archetype);
    if (archetypePreferred) {
      return {
        suggestedCategory: archetypePreferred as InteractionCategory,
        reason: `${friend.archetype}s often enjoy this kind of connection`,
        confidence: 'low',
        recentLocations: uniqueLocations,
      };
    }

    // PRIORITY 4: Most recent category (if all else fails)
    if (friendInteractions.length > 0) {
      const mostRecent = friendInteractions[0];
      if (mostRecent.interactionCategory) {
        return {
          suggestedCategory: mostRecent.interactionCategory as InteractionCategory,
          reason: 'Building on your last connection',
          confidence: 'low',
          recentLocations: uniqueLocations,
        };
      }
    }

    // No suggestion available
    return null;
  } catch (error) {
    console.error('Error generating plan suggestion:', error);
    return null;
  }
}

/**
 * Find if there's a strong pattern (3+ of same category in last 3 months)
 */
function findStrongPattern(
  interactions: Interaction[]
): { category: InteractionCategory; count: number } | null {
  const categoryCounts: Record<string, number> = {};

  interactions.forEach(i => {
    if (i.interactionCategory) {
      categoryCounts[i.interactionCategory] = (categoryCounts[i.interactionCategory] || 0) + 1;
    }
  });

  // Find categories with 3+ occurrences
  const patterns = Object.entries(categoryCounts)
    .filter(([_, count]) => count >= 3)
    .sort(([_, a], [__, b]) => b - a);

  if (patterns.length > 0) {
    return {
      category: patterns[0][0] as InteractionCategory,
      count: patterns[0][1],
    };
  }

  return null;
}

/**
 * Find category with highest average vibe score
 */
function findHighVibeCategory(
  interactions: Interaction[]
): { category: InteractionCategory; avgVibe: number } | null {
  const categoryVibes: Record<string, { total: number; count: number }> = {};

  // Map vibe to numeric score
  const vibeScores: Record<string, number> = {
    'new-moon': 1,
    'waxing-crescent': 2,
    'first-quarter': 3,
    'waxing-gibbous': 4,
    'full-moon': 5,
  };

  interactions.forEach(i => {
    if (i.interactionCategory && i.vibe && vibeScores[i.vibe]) {
      if (!categoryVibes[i.interactionCategory]) {
        categoryVibes[i.interactionCategory] = { total: 0, count: 0 };
      }
      categoryVibes[i.interactionCategory].total += vibeScores[i.vibe];
      categoryVibes[i.interactionCategory].count += 1;
    }
  });

  // Find category with highest average (min 2 data points)
  const highVibe = Object.entries(categoryVibes)
    .filter(([_, { count }]) => count >= 2)
    .map(([category, { total, count }]) => ({
      category: category as InteractionCategory,
      avgVibe: total / count,
    }))
    .sort((a, b) => b.avgVibe - a.avgVibe);

  if (highVibe.length > 0 && highVibe[0].avgVibe >= 4) {
    return highVibe[0];
  }

  return null;
}

function capitalize(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
