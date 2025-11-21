// src/lib/oracle/context-builder.ts
import { Q } from '@nozbe/watermelondb';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Database } from '@nozbe/watermelondb';
import JournalEntry from '@/db/models/JournalEntry';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';

// Define the types used in the ContextBuilder
interface JournalContext {
  entryText: string;
  storyChips: string[];
  friends: {
    archetype: string;
    tier: number;
    relationshipType: string;
  }[];
  timestamp: Date;
}

interface WeeklyContext {
  interactionSummary: {
    archetype: string;
    tier: number;
    category: string;
    storyChips: string[];
    note: string;
    vibe: number;
  }[];
  journalSummary: {
    content: string;
    storyChips: string[];
    friendArchetypes: string[];
  }[];
  weekStats: {
    totalWeaves: number;
    uniqueFriends: number;
    dominantChips: string[];
  };
}

export class ContextBuilder {
  // Sanitizes and structures data for LLM
  static async buildJournalContext(
    entry: JournalEntry,
    relatedFriends?: Friend[]
  ): Promise<JournalContext> {
    return {
      entryText: entry.content,
      storyChips: entry.storyChips || [],
      friends: relatedFriends?.map(f => ({
        archetype: f.archetype,
        tier: f.dunbarTier,
        relationshipType: f.relationshipType
        // Note: Not sending names for privacy
      })),
      timestamp: entry.entryDate
    };
  }

  static async buildWeeklyContext(
    userId: string,
    database: Database
  ): Promise<WeeklyContext> {
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());

    // Gather interactions from this week
    const interactions = await database.collections
      .get<Interaction>('interactions')
      .query(
        Q.where('user_id', userId),
        Q.where('weave_date', Q.between(weekStart.getTime(), weekEnd.getTime()))
      )
      .fetch();

    // Gather journal entries from this week
    const journalEntries = await database.collections
      .get<JournalEntry>('journal_entries')
      .query(
        Q.where('user_id', userId),
        Q.where('entry_date', Q.between(weekStart.getTime(), weekEnd.getTime()))
      )
      .fetch();

    // Build anonymized summary
    return {
      interactionSummary: interactions.map(i => ({
        archetype: i.friend.archetype, // via relation
        tier: i.friend.dunbarTier,
        category: i.interactionCategory,
        storyChips: i.reflection?.storyChips || [],
        note: i.note, // User's reflection
        vibe: i.vibe
      })),
      journalSummary: journalEntries.map(j => ({
        content: j.content,
        storyChips: j.storyChips,
        friendArchetypes: j.friends.map(f => f.archetype)
      })),
      weekStats: {
        totalWeaves: interactions.length,
        uniqueFriends: new Set(interactions.map(i => i.friendId)).size,
        dominantChips: this.getMostFrequentChips(interactions, journalEntries)
      }
    };
  }

  private static getMostFrequentChips(
    interactions: Interaction[],
    journals: JournalEntry[]
  ): string[] {
    const chipCounts = new Map<string, number>();

    [...interactions, ...journals].forEach(item => {
      (item.storyChips || []).forEach(chip => {
        chipCounts.set(chip, (chipCounts.get(chip) || 0) + 1);
      });
    });

    return Array.from(chipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([chip]) => chip);
  }
}
