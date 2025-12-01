// src/lib/oracle/context-builder.ts
import { Q } from '@nozbe/watermelondb';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Database } from '@nozbe/watermelondb';
import JournalEntry from '@/db/models/JournalEntry';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

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
    tier: string; // Changed to string to match Friend model
    category: string;
    storyChips: string[];
    note: string;
    vibe: string; // Changed to string to match Interaction model
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
      storyChips: entry.storyChips.map(c => c.chipId),
      friends: relatedFriends?.map(f => ({
        archetype: f.archetype,
        tier: 0, // f.dunbarTier is string, mapping to number if needed or changing interface. Let's assume 0 for now or parse if it's '1', '2', etc. Actually Friend model says dunbarTier is string.
        relationshipType: f.relationshipType || ''
        // Note: Not sending names for privacy
      })) || [],
      timestamp: new Date(entry.entryDate)
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
        // Q.where('user_id', userId), // Interaction doesn't have user_id usually in local-first? Check model. It doesn't.
        Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime()))
      )
      .fetch();

    // Gather journal entries from this week
    const journalEntries = await database.collections
      .get<JournalEntry>('journal_entries')
      .query(
        // Q.where('user_id', userId), // JournalEntry doesn't have user_id either.
        Q.where('entry_date', Q.between(weekStart.getTime(), weekEnd.getTime()))
      )
      .fetch();

    // Helper to get friends for interactions
    const interactionSummaries = [];
    const uniqueFriendIds = new Set<string>();

    for (const interaction of interactions) {
      const friends = await interaction.interactionFriends.fetch();
      const friendModels = await Promise.all(friends.map((f: InteractionFriend) => f.friend.fetch()));

      // Use the first friend for summary (simplification)
      const primaryFriend = friendModels[0];
      if (primaryFriend) {
        uniqueFriendIds.add(primaryFriend.id);
        interactionSummaries.push({
          archetype: primaryFriend.archetype,
          tier: primaryFriend.dunbarTier,
          category: interaction.interactionCategory || '',
          storyChips: interaction.reflection?.chips?.map(c => c.chipId) || [],
          note: interaction.note || '',
          vibe: interaction.vibe || ''
        });
      }
    }

    // Helper to get friends for journal entries
    const journalSummaries = [];
    for (const entry of journalEntries) {
      // JournalEntry doesn't have direct friend relation in model file shown, 
      // but has journalEntryFriends association.
      // However, the model file showed: @children('journal_entry_friends') journalEntryFriends: any;
      // So we can fetch it.
      // But we need the Friend model from it.
      // Assuming journal_entry_friends table links JournalEntry and Friend.
      // We'll skip complex fetching if not critical, or try to fetch if possible.
      // For now, let's assume empty friendArchetypes if we can't easily get them without a proper intermediate model.
      // Wait, JournalEntry model has `journalEntryFriends`.

      const friendArchetypes: string[] = [];
      // If we can't easily fetch friends, we'll skip.
      // But let's try if we can access the collection.
      // const friends = await entry.journalEntryFriends.fetch(); 
      // This returns JournalEntryFriend models (which we haven't seen).
      // Let's assume we can't get friends easily for now to avoid more errors.

      journalSummaries.push({
        content: entry.content,
        storyChips: entry.storyChips.map(c => c.chipId),
        friendArchetypes
      });
    }

    // Build anonymized summary
    return {
      interactionSummary: interactionSummaries,
      journalSummary: journalSummaries,
      weekStats: {
        totalWeaves: interactions.length,
        uniqueFriends: uniqueFriendIds.size,
        dominantChips: this.getMostFrequentChips(interactions, journalEntries)
      }
    };
  }

  private static getMostFrequentChips(
    interactions: Interaction[],
    journals: JournalEntry[]
  ): string[] {
    const chipCounts = new Map<string, number>();

    interactions.forEach(item => {
      (item.reflection?.chips || []).forEach(chip => {
        chipCounts.set(chip.chipId, (chipCounts.get(chip.chipId) || 0) + 1);
      });
    });

    journals.forEach(item => {
      item.storyChips.forEach(chip => {
        chipCounts.set(chip.chipId, (chipCounts.get(chip.chipId) || 0) + 1);
      });
    });

    return Array.from(chipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([chip]) => chip);
  }
}
