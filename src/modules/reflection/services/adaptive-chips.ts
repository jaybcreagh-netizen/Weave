/**
 * Adaptive Chip Tracking System
 *
 * Handles:
 * - Recording chip usage to database
 * - Calculating frequency scores for adaptive suggestions
 * - Managing custom chips
 * - Suggesting new custom chips based on patterns
 */

import { database } from '@/db';
import CustomChip from '@/db/models/CustomChip';
import ChipUsage from '@/db/models/ChipUsage';
import { incrementUsage } from './custom-chip.service';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { calculateChipFrequency, suggestCustomChip, createCustomChip, type StoryChip, type ChipType } from './story-chips.service';
import { type ReflectionChip } from '@/shared/types/legacy-types';
import { Q } from '@nozbe/watermelondb';

/**
 * Record chip usage in the database for adaptive tracking
 */
export async function recordChipUsage(
  chipId: string,
  chipType: ChipType,
  interactionId: string,
  friendId?: string,
  isCustom: boolean = false
): Promise<void> {
  await database.write(async () => {
    await database.get<ChipUsage>('chip_usage').create(usage => {
      usage.chipId = chipId;
      usage.chipType = chipType;
      usage.interactionId = interactionId;
      usage.friendId = friendId;
      usage.isCustom = isCustom;
      usage.usedAt = new Date();
    });

    // If custom chip, increment its usage count
    if (isCustom) {
      const customChipsCollection = database.get<CustomChip>('custom_chips');
      const customChip = await customChipsCollection.query(
        Q.where('chip_id', chipId)
      ).fetch();

      if (customChip.length > 0) {
        await incrementUsage(customChip[0]);
      }
    }
  });
}

/**
 * Get frequency scores for adaptive chip suggestions
 * Returns normalized scores (0-1) based on recent usage (last 90 days)
 */
export async function getChipFrequencyScores(): Promise<Record<string, number>> {
  const chipUsageCollection = database.get<ChipUsage>('chip_usage');
  const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));

  const recentUsage = await chipUsageCollection
    .query(
      Q.where('used_at', Q.gte(ninetyDaysAgo.getTime()))
    )
    .fetch();

  const usageHistory = recentUsage.map(usage => ({
    chipId: usage.chipId,
    timestamp: usage.usedAt.getTime(),
  }));

  return calculateChipFrequency(usageHistory);
}

/**
 * Get all custom chips
 */
export async function getAllCustomChips(): Promise<CustomChip[]> {
  const customChipsCollection = database.get<CustomChip>('custom_chips');
  return await customChipsCollection.query().fetch();
}

/**
 * Get custom chips converted to StoryChip format
 */
export async function getCustomChipsAsStoryChips(): Promise<StoryChip[]> {
  const customChips = await getAllCustomChips();
  return customChips.map(chip => chip.toStoryChip());
}

/**
 * Create a new custom chip
 */
export async function createNewCustomChip(
  plainText: string,
  type: ChipType
): Promise<CustomChip> {
  const chip = createCustomChip(plainText, type, 'local');

  return await database.write(async () => {
    return await database.get<CustomChip>('custom_chips').create(customChip => {
      customChip.chipId = chip.id;
      customChip.chipType = chip.type;
      customChip.plainText = chip.plainText;
      customChip.template = chip.template;
      customChip.usageCount = 0;
    });
  });
}

/**
 * Analyze custom notes for pattern detection and suggest custom chips
 * Limited to recent interactions to avoid loading entire database
 */
export async function analyzeCustomNotesForPatterns(
  chipType: ChipType,
  minOccurrences: number = 3
): Promise<{ suggestedText: string; occurrences: number } | null> {
  // Get recent interactions with custom notes (last 100 interactions)
  const interactionsCollection = database.get<Interaction>('interactions');
  const recentInteractions = await interactionsCollection
    .query(
      Q.sortBy('interaction_date', Q.desc),
      Q.take(100)
    )
    .fetch();

  const customNotes: string[] = [];

  recentInteractions.forEach((interaction: Interaction) => {
    if (interaction.reflection?.customNotes) {
      customNotes.push(interaction.reflection.customNotes);
    }
  });

  return suggestCustomChip(customNotes, minOccurrences);
}

/**
 * Get most used chips (for "Your Patterns" section)
 */
export async function getMostUsedChips(limit: number = 5): Promise<Array<{ chipId: string; count: number; isCustom: boolean }>> {
  const chipUsageCollection = database.get<ChipUsage>('chip_usage');
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

  const recentUsage = await chipUsageCollection.query(
    Q.where('used_at', Q.gte(thirtyDaysAgo.getTime()))
  ).fetch();

  // Count usage by chip
  const chipCounts: Record<string, { count: number; isCustom: boolean }> = {};

  recentUsage.forEach(usage => {
    if (!chipCounts[usage.chipId]) {
      chipCounts[usage.chipId] = { count: 0, isCustom: usage.isCustom };
    }
    chipCounts[usage.chipId].count++;
  });

  // Sort by count and take top N
  return Object.entries(chipCounts)
    .map(([chipId, data]) => ({
      chipId,
      count: data.count,
      isCustom: data.isCustom,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get chip usage for a specific friend (for friend-specific patterns)
 */
export async function getFriendChipUsage(friendId: string): Promise<ChipUsage[]> {
  const chipUsageCollection = database.get<ChipUsage>('chip_usage');
  return await chipUsageCollection.query(
    Q.where('friend_id', friendId)
  ).fetch();
}

/**
 * Record chips from a reflection when an interaction is saved
 * This should be called after saving an interaction with reflection data
 */
export async function recordReflectionChips(
  reflectionChips: ReflectionChip[],
  interactionId: string,
  friendId?: string
): Promise<void> {
  const customChips = await getAllCustomChips();
  const customChipIds = new Set(customChips.map(c => c.chipId));

  for (const chip of reflectionChips) {
    const isCustom = customChipIds.has(chip.chipId);

    // Determine chip type from chipId prefix or lookup
    let chipType: ChipType = 'activity'; // default
    if (chip.chipId.startsWith('activity_')) chipType = 'activity';
    else if (chip.chipId.startsWith('setting_')) chipType = 'setting';
    else if (chip.chipId.startsWith('people_')) chipType = 'people';
    else if (chip.chipId.startsWith('dynamic_')) chipType = 'dynamic';
    else if (chip.chipId.startsWith('topic_')) chipType = 'topic';
    else if (chip.chipId.startsWith('feeling_')) chipType = 'feeling';
    else if (chip.chipId.startsWith('moment_')) chipType = 'moment';
    else if (chip.chipId.startsWith('surprise_')) chipType = 'surprise';
    else if (chip.chipId.startsWith('custom_')) {
      // For custom chips, look up the type
      const customChip = customChips.find(c => c.chipId === chip.chipId);
      if (customChip) {
        chipType = customChip.chipType;
      }
    }

    await recordChipUsage(chip.chipId, chipType, interactionId, friendId, isCustom);
  }
}

/**
 * Pattern Insight Interface
 */
export interface PatternInsight {
  message: string;
  type: 'chip_frequency' | 'first_time' | 'reconnection';
}

/**
 * Generate pattern insights for a specific friend
 * Returns relevant patterns to show during reflection
 */
export async function generatePatternInsights(
  friendId?: string,
  selectedChipIds: string[] = []
): Promise<PatternInsight[]> {
  const insights: PatternInsight[] = [];

  if (!friendId) {
    return insights; // No friend-specific insights without friendId
  }

  // Get friend's chip usage history
  const friendUsage = await getFriendChipUsage(friendId);

  // Get friend name (we'll need to query the friend)
  const friendsCollection = database.get<FriendModel>('friends');
  const friend = await friendsCollection.find(friendId);
  const friendName = friend.name || 'them';

  // Calculate 30-day window
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const recentUsage = friendUsage.filter(u => u.usedAt.getTime() >= thirtyDaysAgo.getTime());

  // Check for chip frequency patterns
  for (const chipId of selectedChipIds) {
    const chipUsageCount = recentUsage.filter(u => u.chipId === chipId).length;

    if (chipUsageCount >= 3) {
      // Get chip plain text from ALL_STORY_CHIPS
      const { STORY_CHIPS: ALL_CHIPS } = await import('./story-chips.service');
      const chip = ALL_CHIPS.find((c: any) => c.id === chipId);
      const chipText = chip?.plainText || chipId;

      insights.push({
        message: `${chipUsageCount + 1}${getOrdinalSuffix(chipUsageCount + 1)} time "${chipText}" with ${friendName} this month`,
        type: 'chip_frequency',
      });
    } else if (chipUsageCount === 0) {
      // First time using this chip with this friend
      const { STORY_CHIPS: ALL_CHIPS } = await import('./story-chips.service');
      const chip = ALL_CHIPS.find((c: any) => c.id === chipId);

      // Only show for significant/notable chips
      const notableChipIds = [
        'topic_fears',
        'topic_struggles',
        'dynamic_i-opened-up',
        'dynamic_they-opened-up',
        'moment_breakthrough',
        'moment_they-shared',
        'surprise_deeper-than-expected',
      ];

      if (notableChipIds.includes(chipId) && chip) {
        insights.push({
          message: `First time "${chip.plainText}" with ${friendName}`,
          type: 'first_time',
        });
      }
    }
  }

  // Limit to top 2 most relevant insights
  return insights.slice(0, 2);
}

/**
 * Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}
