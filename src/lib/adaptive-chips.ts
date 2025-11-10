/**
 * Adaptive Chip Tracking System
 *
 * Handles:
 * - Recording chip usage to database
 * - Calculating frequency scores for adaptive suggestions
 * - Managing custom chips
 * - Suggesting new custom chips based on patterns
 */

import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import CustomChip from '../db/models/CustomChip';
import ChipUsage from '../db/models/ChipUsage';
import { calculateChipFrequency, suggestCustomChip, createCustomChip, type StoryChip, type ChipType } from './story-chips';
import { type ReflectionChip } from '../components/types';

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
      usage.usedAt = Date.now();
    });

    // If custom chip, increment its usage count
    if (isCustom) {
      const customChipsCollection = database.get<CustomChip>('custom_chips');
      const customChip = await customChipsCollection.query(
        Q.where('chip_id', chipId)
      ).fetch();

      if (customChip.length > 0) {
        await customChip[0].incrementUsage();
      }
    }
  });
}

/**
 * Get frequency scores for adaptive chip suggestions
 * Returns normalized scores (0-1) based on recent usage
 */
export async function getChipFrequencyScores(): Promise<Record<string, number>> {
  const chipUsageCollection = database.get<ChipUsage>('chip_usage');
  const allUsage = await chipUsageCollection.query().fetch();

  const usageHistory = allUsage.map(usage => ({
    chipId: usage.chipId,
    timestamp: usage.usedAt,
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
 */
export async function analyzeCustomNotesForPatterns(
  chipType: ChipType,
  minOccurrences: number = 3
): Promise<{ suggestedText: string; occurrences: number } | null> {
  // Get all interactions with custom notes
  const interactionsCollection = database.get('interactions');
  const interactions = await interactionsCollection.query().fetch();

  const customNotes: string[] = [];

  interactions.forEach((interaction: any) => {
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
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const recentUsage = await chipUsageCollection.query(
    Q.where('used_at', Q.gte(thirtyDaysAgo))
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
