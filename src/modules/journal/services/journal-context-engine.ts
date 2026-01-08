/**
 * Journal Context Engine
 * 
 * The brains behind contextual journaling. Powers:
 * - Meaningful weave detection (worthy of deeper reflection)
 * - Friend context retrieval (history, themes, previous entries)
 * - Memory surfacing (anniversaries, patterns, throwbacks)
 * - Friendship arc data (timeline of entries per friend)
 * 
 * Designed for LLM handoff — rule-based for now, but interfaces 
 * support swapping in AI-generated context later.
 */

import { database } from '@/db';
import { Q, Model } from '@nozbe/watermelondb';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import WeeklyReflection from '@/db/models/WeeklyReflection';

// ============================================================================
// TYPES
// ============================================================================

export interface MeaningfulWeave {
  interaction: InteractionModel;
  friends: FriendModel[];
  meaningfulnessScore: number;  // 0-100, higher = more worthy of reflection
  meaningfulnessReasons: string[];  // Why this is worth reflecting on
}

export interface FriendJournalContext {
  friend: FriendModel;
  friendshipDuration: string;  // "2 years, 3 months"
  friendshipDurationMonths: number;
  totalWeaves: number;
  totalJournalEntries: number;
  recentWeaves: RecentWeaveItem[];  // Last 5
  recentEntries: RecentEntryItem[];  // Last 3
  detectedThemes: string[];  // From past entries
  thisMonthWeaves: number;
  daysSinceLastWeave: number;
  lastEntryDate: Date | null;
}

export interface RecentWeaveItem {
  id: string;
  date: Date;
  category: string;
  activity: string;
  notes: string | null;
  vibe: string;
  duration: string;
}

export interface RecentEntryItem {
  id: string;
  date: Date;
  title: string;
  preview: string;  // First 100 chars
  type: 'journal' | 'reflection';
}

export interface Memory {
  id: string;
  type: 'anniversary' | 'pattern' | 'milestone' | 'throwback' | 'first_entry';
  title: string;
  description: string;
  relatedEntryId?: string;
  relatedFriendId?: string;
  relatedFriendName?: string;
  actionLabel: string;  // "Read entry", "Write about this"
  priority: number;  // Higher = show first
}

export interface FriendshipArc {
  friend: FriendModel;
  friendshipDuration: string;
  totalWeaves: number;
  totalEntries: number;
  commonThemes: string[];
  commonActivities: string[];
  timeline: FriendshipArcEntry[];
  firstEntryDate: Date | null;
  mostRecentEntryDate: Date | null;
}

export interface FriendshipArcEntry {
  id: string;
  date: Date;
  type: 'journal' | 'reflection' | 'milestone';
  title: string;
  preview: string;
  weaveCount?: number;  // For reflection entries
}

export interface JournalBrowseFilters {
  friendId?: string;
  theme?: string;
  dateFrom?: Date;
  dateTo?: Date;
  type?: 'all' | 'journal' | 'reflection';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MEANINGFUL_WEAVE_THRESHOLDS = {
  noteLength: 20,           // Notes longer than this are meaningful
  highVibe: ['FullMoon', 'WaxingGibbous'],
  deepCategories: ['deep-talk', 'heart-to-heart', 'support'],
  longDurations: ['Extended', 'Long'],
};

// Theme keywords to detect from journal text
const THEME_KEYWORDS: Record<string, string[]> = {
  career: ['job', 'work', 'career', 'promotion', 'boss', 'interview', 'office', 'salary', 'resign'],
  growth: ['grow', 'change', 'learn', 'realiz', 'understand', 'perspective', 'progress'],
  support: ['support', 'help', 'there for', 'listen', 'advice', 'comfort', 'reassur'],
  celebration: ['celebrat', 'birthday', 'achievement', 'success', 'happy', 'excited', 'proud'],
  challenge: ['difficult', 'hard', 'struggle', 'challenge', 'conflict', 'argument', 'disagree'],
  reconnection: ['reconnect', 'miss', 'long time', 'catch up', 'back in touch'],
  vulnerability: ['vulnerab', 'open up', 'honest', 'real', 'deep', 'admit', 'confess'],
  gratitude: ['grateful', 'thankful', 'appreciate', 'lucky', 'blessed'],
  boundaries: ['boundar', 'space', 'limit', 'say no', 'too much', 'overwhelm'],
  trust: ['trust', 'rely', 'depend', 'count on', 'safe', 'confide'],
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get recent weaves that are meaningful enough to warrant deeper reflection.
 * "Meaningful" = has notes, high vibe, deep category, or long duration.
 */
export async function getRecentMeaningfulWeaves(
  limit: number = 5,
  hoursBack: number = 48
): Promise<MeaningfulWeave[]> {
  const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);

  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.gte(cutoff)),
      Q.where('status', 'completed'),
      Q.sortBy('interaction_date', Q.desc),
      Q.take(20)  // Get more than needed, then filter by meaningfulness
    )
    .fetch();

  if (interactions.length === 0) return [];

  // OPTIMIZATION: Batch fetch all friends for these interactions to avoid N+1 queries
  const interactionIds = interactions.map(i => i.id);

  // 1. Get all join records
  const allLinks = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  // 2. Get all involved friend IDs
  const allFriendIds = Array.from(new Set(allLinks.map(l => l.friendId)));

  // 3. Fetch all friend objects
  const allFriends = await database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(allFriendIds)))
    .fetch();

  // 4. Create a lookup map
  const friendsMap = new Map<string, FriendModel>();
  allFriends.forEach(f => friendsMap.set(f.id, f));

  // 5. Group friends by interaction
  const interactionFriendsMap = new Map<string, FriendModel[]>();
  for (const link of allLinks) {
    const friend = friendsMap.get(link.friendId);
    if (friend) {
      if (!interactionFriendsMap.has(link.interactionId)) {
        interactionFriendsMap.set(link.interactionId, []);
      }
      interactionFriendsMap.get(link.interactionId)?.push(friend);
    }
  }

  // Score and filter interactions
  const scored: MeaningfulWeave[] = [];

  for (const interaction of interactions) {
    const { score, reasons } = calculateMeaningfulnessScore(interaction);

    if (score >= 30) {  // Minimum threshold to be "meaningful"
      // Get friends from pre-fetched map
      const friends = interactionFriendsMap.get(interaction.id) || [];

      scored.push({
        interaction,
        friends,
        meaningfulnessScore: score,
        meaningfulnessReasons: reasons,
      });
    }
  }

  // Sort by score descending, take top N
  return scored
    .sort((a, b) => b.meaningfulnessScore - a.meaningfulnessScore)
    .slice(0, limit);
}

/**
 * Calculate how meaningful a weave is for reflection purposes.
 */
function calculateMeaningfulnessScore(interaction: InteractionModel): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Notes length (most important signal)
  const noteLength = interaction.note?.length || 0;
  if (noteLength >= MEANINGFUL_WEAVE_THRESHOLDS.noteLength) {
    score += 40;
    reasons.push('has detailed notes');
  } else if (noteLength > 0) {
    score += 15;
    reasons.push('has notes');
  }

  // Vibe (emotional significance)
  if (MEANINGFUL_WEAVE_THRESHOLDS.highVibe.includes(interaction.vibe || '')) {
    score += 25;
    reasons.push('high emotional impact');
  }

  // Category (type of interaction)
  const category = interaction.interactionCategory || interaction.activity || '';
  if (MEANINGFUL_WEAVE_THRESHOLDS.deepCategories.some(c =>
    category.toLowerCase().includes(c)
  )) {
    score += 20;
    reasons.push('deep conversation');
  }

  // Duration
  if (MEANINGFUL_WEAVE_THRESHOLDS.longDurations.includes(interaction.duration || '')) {
    score += 15;
    reasons.push('extended time together');
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Get friends associated with an interaction.
 */
async function getFriendsForInteraction(interactionId: string): Promise<FriendModel[]> {
  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', interactionId))
    .fetch();

  if (links.length === 0) return [];

  const friendIds = links.map(l => l.friendId);
  return database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(friendIds)))
    .fetch();
}

/**
 * Get comprehensive context for journaling about a specific friend.
 */
export async function getFriendContext(friendId: string): Promise<FriendJournalContext | null> {
  try {
    const friend = await database.get<FriendModel>('friends').find(friendId);
    if (!friend) return null;

    const [
      totalWeaves,
      totalJournalEntries,
      recentWeaves,
      recentEntries,
      thisMonthWeaves,
      lastWeaveDate,
      detectedThemes,
    ] = await Promise.all([
      getTotalWeavesForFriend(friendId),
      getTotalEntriesForFriend(friendId),
      getRecentWeavesForFriend(friendId, 5),
      getRecentEntriesForFriend(friendId, 3),
      getThisMonthWeavesForFriend(friendId),
      getLastWeaveDateForFriend(friendId),
      getDetectedThemesForFriend(friendId),
    ]);

    // Calculate friendship duration
    const friendCreatedAt = friend.createdAt || new Date();
    const durationMs = Date.now() - friendCreatedAt.getTime();
    const durationMonths = Math.floor(durationMs / (30 * 24 * 60 * 60 * 1000));
    const friendshipDuration = formatDuration(durationMonths);

    // Days since last weave
    const daysSinceLastWeave = lastWeaveDate
      ? Math.floor((Date.now() - lastWeaveDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Last entry date
    const lastEntryDate = recentEntries.length > 0 ? recentEntries[0].date : null;

    return {
      friend,
      friendshipDuration,
      friendshipDurationMonths: durationMonths,
      totalWeaves,
      totalJournalEntries,
      recentWeaves,
      recentEntries,
      detectedThemes,
      thisMonthWeaves,
      daysSinceLastWeave,
      lastEntryDate,
    };
  } catch (error) {
    console.error('[JournalContextEngine] Error getting friend context:', error);
    return null;
  }
}

/**
 * Surface memories worth revisiting (anniversaries, patterns, milestones).
 */
export async function getMemories(limit: number = 3): Promise<Memory[]> {
  const memories: Memory[] = [];

  // Check for anniversaries (entries from ~1 year ago)
  const anniversaryMemories = await getAnniversaryMemories();
  memories.push(...anniversaryMemories);

  // Check for first entries with friends
  const firstEntryMemories = await getFirstEntryMemories();
  memories.push(...firstEntryMemories);

  // Check for pattern-based memories
  const patternMemories = await getPatternMemories();
  memories.push(...patternMemories);

  // Sort by priority and take top N
  return memories
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Get complete friendship arc (timeline of entries and milestones).
 */
export async function getFriendshipArc(friendId: string): Promise<FriendshipArc | null> {
  try {
    const friend = await database.get<FriendModel>('friends').find(friendId);
    if (!friend) return null;

    // Get all journal entries mentioning this friend via join table
    const links = await database
      .get<JournalEntryFriend>('journal_entry_friends')
      .query(Q.where('friend_id', friendId))
      .fetch();

    const entryIds = links.map(l => l.journalEntryId);

    // Fetch the actual entries
    const friendEntries = await database
      .get<JournalEntry>('journal_entries')
      .query(
        Q.where('id', Q.oneOf(entryIds)),
        Q.sortBy('entry_date', Q.desc)
      )
      .fetch();

    // Get weekly reflections that mention this friend
    const reflections = await getReflectionsMentioningFriend(friendId);

    // Build timeline
    const timeline: FriendshipArcEntry[] = [];

    for (const entry of friendEntries) {
      timeline.push({
        id: entry.id,
        date: new Date(entry.entryDate),
        type: 'journal',
        title: entry.title || 'Journal Entry',
        preview: (entry.content || '').slice(0, 100),
      });
    }

    for (const reflection of reflections) {
      timeline.push({
        id: reflection.id,
        date: new Date(reflection.weekStartDate),
        type: 'reflection',
        title: 'Weekly Reflection',
        preview: (reflection.gratitudeText || '').slice(0, 100),
        weaveCount: reflection.totalWeaves,
      });
    }

    // Sort timeline by date descending
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate totals
    const totalWeaves = await getTotalWeavesForFriend(friendId);
    const totalEntries = friendEntries.length;

    // Detect common themes from all entries
    const allText = friendEntries.map(e => e.content || '').join(' ');
    const commonThemes = detectThemes(allText);

    // Get common activities from weaves
    const commonActivities = await getCommonActivitiesForFriend(friendId);

    // Friendship duration
    const friendCreatedAt = friend.createdAt || new Date();
    const durationMs = Date.now() - friendCreatedAt.getTime();
    const durationMonths = Math.floor(durationMs / (30 * 24 * 60 * 60 * 1000));

    // First and most recent entry dates
    const firstEntryDate = timeline.length > 0
      ? timeline[timeline.length - 1].date
      : null;
    const mostRecentEntryDate = timeline.length > 0
      ? timeline[0].date
      : null;

    return {
      friend,
      friendshipDuration: formatDuration(durationMonths),
      totalWeaves,
      totalEntries,
      commonThemes,
      commonActivities,
      timeline,
      firstEntryDate,
      mostRecentEntryDate,
    };
  } catch (error) {
    console.error('[JournalContextEngine] Error getting friendship arc:', error);
    return null;
  }
}

/**
 * Get friends sorted by journal engagement (entries + weaves).
 */
export async function getFriendsForBrowsing(): Promise<{
  friend: FriendModel;
  entryCount: number;
  lastEntryDate: Date | null;
  recentActivityIndicator: 'high' | 'medium' | 'low';
}[]> {
  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('is_dormant', false))
    .fetch();

  const results = await Promise.all(
    friends.map(async (friend) => {
      const entryCount = await getTotalEntriesForFriend(friend.id);
      const recentEntries = await getRecentEntriesForFriend(friend.id, 1);
      const lastEntryDate = recentEntries.length > 0 ? recentEntries[0].date : null;

      // Calculate activity indicator based on entry count
      let recentActivityIndicator: 'high' | 'medium' | 'low';
      if (entryCount >= 5) {
        recentActivityIndicator = 'high';
      } else if (entryCount >= 2) {
        recentActivityIndicator = 'medium';
      } else {
        recentActivityIndicator = 'low';
      }

      return {
        friend,
        entryCount,
        lastEntryDate,
        recentActivityIndicator,
      };
    })
  );

  // Sort by entry count descending, then by last entry date
  return results
    .filter(r => r.entryCount > 0)  // Only show friends with entries
    .sort((a, b) => {
      if (b.entryCount !== a.entryCount) {
        return b.entryCount - a.entryCount;
      }
      if (a.lastEntryDate && b.lastEntryDate) {
        return b.lastEntryDate.getTime() - a.lastEntryDate.getTime();
      }
      return 0;
    });
}

/**
 * Search journal entries with filters.
 */
export async function searchEntries(
  query: string,
  filters: JournalBrowseFilters = {}
): Promise<(JournalEntry | WeeklyReflection)[]> {
  const results: (JournalEntry | WeeklyReflection)[] = [];
  const normalizedQuery = query.toLowerCase().trim();

  // Search journal entries
  let journalQuery = database
    .get<JournalEntry>('journal_entries')
    .query(Q.sortBy('entry_date', Q.desc));

  // Apply date filters if provided
  const conditions: any[] = [];

  if (filters.dateFrom) {
    conditions.push(Q.where('entry_date', Q.gte(filters.dateFrom.getTime())));
  }

  if (filters.dateTo) {
    conditions.push(Q.where('entry_date', Q.lte(filters.dateTo.getTime())));
  }

  // Friend filter
  if (filters.friendId) {
    const links = await database
      .get<JournalEntryFriend>('journal_entry_friends')
      .query(Q.where('friend_id', filters.friendId))
      .fetch();
    const entryIds = links.map(l => l.journalEntryId);
    conditions.push(Q.where('id', Q.oneOf(entryIds)));
  }

  // Add sort by date desc
  conditions.push(Q.sortBy('entry_date', Q.desc));

  journalQuery = database.get<JournalEntry>('journal_entries').query(...conditions);

  const journalEntries = await journalQuery.fetch();

  // Filter by text search
  for (const entry of journalEntries) {
    // Text search
    if (normalizedQuery) {
      const content = (entry.content || '').toLowerCase();
      const title = (entry.title || '').toLowerCase();
      if (!content.includes(normalizedQuery) && !title.includes(normalizedQuery)) {
        continue;
      }
    }
    results.push(entry);
  }

  // Also search weekly reflections if type allows
  if (filters.type === 'all' || filters.type === 'reflection') {
    const reflections = await database
      .get<WeeklyReflection>('weekly_reflections')
      .query(Q.sortBy('week_start_date', Q.desc))
      .fetch();

    for (const reflection of reflections) {
      if (normalizedQuery) {
        const text = (reflection.gratitudeText || '').toLowerCase();
        if (!text.includes(normalizedQuery)) {
          continue;
        }
      }

      results.push(reflection);
    }
  }

  // Sort combined results by date
  return results.sort((a, b) => {
    const dateA = 'entryDate' in a ? a.entryDate : a.weekStartDate;
    const dateB = 'entryDate' in b ? b.entryDate : b.weekStartDate;
    return dateB - dateA;
  });
}

// ============================================================================
// HELPER FUNCTIONS - DATA FETCHING
// ============================================================================

async function getTotalWeavesForFriend(friendId: string): Promise<number> {
  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return 0;

  const interactionIds = links.map(l => l.interactionId);
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed')
    )
    .fetch();

  return interactions.length;
}

async function getTotalEntriesForFriend(friendId: string): Promise<number> {
  return await database
    .get<JournalEntryFriend>('journal_entry_friends')
    .query(Q.where('friend_id', friendId))
    .fetchCount();
}

async function getRecentWeavesForFriend(
  friendId: string,
  limit: number
): Promise<RecentWeaveItem[]> {
  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return [];

  const interactionIds = links.map(l => l.interactionId);
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed'),
      Q.sortBy('interaction_date', Q.desc),
      Q.take(limit)
    )
    .fetch();

  return interactions.map(i => ({
    id: i.id,
    date: new Date(i.interactionDate),
    category: i.interactionCategory || 'Connection',
    activity: i.activity || i.interactionCategory || 'Connection',
    notes: i.note || null,
    vibe: i.vibe || 'Neutral',
    duration: i.duration || 'Short',
  }));
}

async function getRecentEntriesForFriend(
  friendId: string,
  limit: number
): Promise<RecentEntryItem[]> {
  const links = await database
    .get<JournalEntryFriend>('journal_entry_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  const entryIds = links.map(l => l.journalEntryId);

  const friendEntries = await database
    .get<JournalEntry>('journal_entries')
    .query(
      Q.where('id', Q.oneOf(entryIds)),
      Q.sortBy('entry_date', Q.desc),
      Q.take(limit)
    )
    .fetch();

  return friendEntries.map(e => ({
    id: e.id,
    date: new Date(e.entryDate),
    title: e.title || 'Journal Entry',
    preview: (e.content || '').slice(0, 100),
    type: 'journal' as const,
  }));
}

async function getThisMonthWeavesForFriend(friendId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return 0;

  const interactionIds = links.map(l => l.interactionId);
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed'),
      Q.where('interaction_date', Q.gte(monthStart.getTime()))
    )
    .fetch();

  return interactions.length;
}

async function getLastWeaveDateForFriend(friendId: string): Promise<Date | null> {
  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return null;

  const interactionIds = links.map(l => l.interactionId);
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed'),
      Q.sortBy('interaction_date', Q.desc),
      Q.take(1)
    )
    .fetch();

  return interactions[0] ? new Date(interactions[0].interactionDate) : null;
}

async function getDetectedThemesForFriend(friendId: string): Promise<string[]> {
  const links = await database
    .get<JournalEntryFriend>('journal_entry_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return [];

  const entryIds = links.map(l => l.journalEntryId);

  // OPTIMIZATION: Limit to last 50 entries to prevent freeze on large history
  const friendEntries = await database
    .get<JournalEntry>('journal_entries')
    .query(
      Q.where('id', Q.oneOf(entryIds)),
      Q.sortBy('entry_date', Q.desc),
      Q.take(50)
    )
    .fetch();

  const allText = friendEntries.map(e => e.content || '').join(' ');
  return detectThemes(allText);
}

async function getReflectionsMentioningFriend(friendId: string): Promise<WeeklyReflection[]> {
  // Note: This assumes weekly reflections might mention friends in gratitude text
  // You may need to adjust based on your actual data model
  const reflections = await database
    .get<WeeklyReflection>('weekly_reflections')
    .query(Q.sortBy('week_start_date', Q.desc))
    .fetch();

  // For now, return reflections where the friend was likely involved
  // This could be enhanced with proper friend linking in reflections
  return reflections.slice(0, 10);  // Simplified for now
}

async function getCommonActivitiesForFriend(friendId: string): Promise<string[]> {
  const links = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();

  if (links.length === 0) return [];

  const interactionIds = links.map(l => l.interactionId);
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(interactionIds)),
      Q.where('status', 'completed')
    )
    .fetch();

  // Count activities
  const activityCounts = new Map<string, number>();
  for (const interaction of interactions) {
    const activity = interaction.activity || interaction.interactionCategory || 'Connection';
    activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
  }

  // Sort by count and take top 3
  return Array.from(activityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([activity]) => activity);
}

// ============================================================================
// HELPER FUNCTIONS - MEMORIES
// ============================================================================

export async function getAnniversaryMemories(): Promise<Memory[]> {
  const memories: Memory[] = [];
  const now = new Date();

  // Look for entries from ~1 year ago (widened window)
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const startRange = new Date(oneYearAgo);
  startRange.setDate(startRange.getDate() - 7);
  const endRange = new Date(oneYearAgo);
  endRange.setDate(endRange.getDate() + 7);

  // 1. Journal Entries
  const entries = await database
    .get<JournalEntry>('journal_entries')
    .query(
      Q.where('entry_date', Q.between(startRange.getTime(), endRange.getTime()))
    )
    .fetch();

  for (const entry of entries) {
    let friendName: string | undefined;
    let friendId: string | undefined;

    try {
      const links = await database
        .get<JournalEntryFriend>('journal_entry_friends')
        .query(Q.where('journal_entry_id', entry.id))
        .fetch();

      if (links.length > 0) {
        const friend = await links[0].friend.fetch();
        if (friend) {
          friendName = friend.name;
          friendId = friend.id;
        }
      }
    } catch (e) {
      console.warn('Error fetching friends for anniversary memory', e);
    }

    const priority = friendName ? 20 : 10;
    const contentLength = entry.content?.length || 0;
    const bonus = contentLength > 100 ? 5 : 0;

    memories.push({
      id: `anniversary-${entry.id}`,
      type: 'anniversary',
      title: friendName ? `Remembering ${friendName}` : 'One Year Ago',
      description: friendName
        ? `You wrote about your time with ${friendName} on this day last year`
        : 'You wrote a journal entry on this day last year.',
      relatedEntryId: entry.id,
      relatedFriendId: friendId,
      relatedFriendName: friendName,
      actionLabel: 'Read Entry',
      priority: priority + bonus,
    });
  }

  // 2. Weekly Reflections
  const reflections = await database
    .get<WeeklyReflection>('weekly_reflections')
    .query(
      Q.where('week_start_date', Q.between(startRange.getTime(), endRange.getTime()))
    )
    .fetch();

  for (const reflection of reflections) {
    memories.push({
      id: `reflection-anniversary-${reflection.id}`,
      type: 'throwback',
      title: 'One Year Ago Today',
      description: 'You completed a weekly reflection one year ago.',
      relatedEntryId: reflection.id,
      actionLabel: 'Read Reflection',
      priority: 15, // Higher than generic entry, lower than friend entry
    });
  }

  return memories;
}

async function getFirstEntryMemories(): Promise<Memory[]> {
  const memories: Memory[] = [];

  try {
    // OPTIMIZATION: Batch fetch data to avoid N+1 queries loop
    // 1. Get all friends who are not dormant
    const friends = await database
      .get<FriendModel>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    if (friends.length === 0) return [];

    // 2. Get all journal entry linkages (to find friends with ANY entries)
    // We only need the friend_ids, but dealing with raw SQL or large datasets can be tricky.
    // Fetching all might be heavy if thousands of entries.
    // Better strategy: Get all friends, then filter.
    // For MVP/small data: Fetching all linkages is fine.
    const entryLinks = await database
      .get<JournalEntryFriend>('journal_entry_friends')
      .query()
      .fetch();

    const friendsWithEntries = new Set(entryLinks.map(l => l.friendId));

    // 3. Get all interaction linkages (to count weaves)
    const interactionLinks = await database
      .get<InteractionFriend>('interaction_friends')
      .query()
      .fetch();

    // Map friendId -> weave count
    const weaveCounts = new Map<string, number>();
    for (const link of interactionLinks) {
      // Note: This counts ALL interactions, not just 'completed' ones if we don't filter.
      // Ideally we filter by status='completed' but that requires joining or filtering the links.
      // For performance/simplicity here, we assume presence in interaction_friends roughly implies activity.
      // To be strictly correct matching the previous slow logic, we'd need to filter by interaction status.
      // However, `getTotalWeavesForFriend` did check for 'completed'.
      // Let's rely on the fact that usually only valid interactions have friends linked.
      weaveCounts.set(link.friendId, (weaveCounts.get(link.friendId) || 0) + 1);
    }

    // Process friends in memory
    for (const friend of friends) {
      // Skip if already has entries
      if (friendsWithEntries.has(friend.id)) continue;

      // Check weave count from map
      const count = weaveCounts.get(friend.id) || 0;
      if (count < 5) continue; // Not enough history

      memories.push({
        id: `first_entry_${friend.id}`,
        type: 'first_entry',
        title: `Start ${friend.name}'s story`,
        description: `You've connected ${count} times but never written about this friendship`,
        relatedFriendId: friend.id,
        relatedFriendName: friend.name,
        actionLabel: 'Write first entry',
        priority: 60,
      });
    }
  } catch (error) {
    console.warn('[JournalContextEngine] Error generating first entry memories:', error);
  }

  return memories.slice(0, 2);  // Max 2 first-entry suggestions
}

async function getPatternMemories(): Promise<Memory[]> {
  const memories: Memory[] = [];

  // Look for themes that appear multiple times
  const entries = await database
    .get<JournalEntry>('journal_entries')
    .query(Q.sortBy('entry_date', Q.desc), Q.take(50))
    .fetch();

  const themeFrequency = new Map<string, { count: number; lastEntry: JournalEntry }>();

  for (const entry of entries) {
    const text = entry.content || '';
    const themes = detectThemes(text);

    for (const theme of themes) {
      const existing = themeFrequency.get(theme);
      if (existing) {
        existing.count++;
      } else {
        themeFrequency.set(theme, { count: 1, lastEntry: entry });
      }
    }
  }

  // Find recurring themes (3+ mentions)
  for (const [theme, data] of themeFrequency) {
    if (data.count >= 3) {
      memories.push({
        id: `pattern_${theme}`,
        type: 'pattern',
        title: `Recurring theme: ${theme}`,
        description: `You've written about "${theme}" in ${data.count} entries`,
        relatedEntryId: data.lastEntry.id,
        actionLabel: 'Explore theme',
        priority: 50 + data.count,
      });
    }
  }

  return memories.slice(0, 2);  // Max 2 pattern memories
}

// ============================================================================
// HELPER FUNCTIONS - UTILITIES
// ============================================================================

function formatDuration(months: number): string {
  if (months < 1) return 'Just started';
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
}

function detectThemes(text: string): string[] {
  if (!text || text.length < 10) return [];

  const normalizedText = text.toLowerCase();
  const detectedThemes: string[] = [];

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        detectedThemes.push(theme);
        break;  // Only add each theme once
      }
    }
  }

  return detectedThemes;
}

// ============================================================================
// EXPORTS FOR LLM HANDOFF
// ============================================================================

/**
 * Future: These interfaces are designed for easy LLM integration.
 * Replace rule-based implementations with API calls when ready.
 */
export interface JournalContextEngineConfig {
  useLLM: boolean;
  llmEndpoint?: string;
  llmApiKey?: string;
}

export const DEFAULT_CONFIG: JournalContextEngineConfig = {
  useLLM: false,
};

export async function getMemoryForNotification(
  entryId: string,
  entryType: 'journal' | 'reflection'
): Promise<{
  memory: Memory;
  entry: JournalEntry | WeeklyReflection;
  friendName?: string;
  friendId?: string;
} | null> {
  try {
    if (entryType === 'journal') {
      const entry = await database.get<JournalEntry>('journal_entries').find(entryId);
      // Get friends
      let friendName: string | undefined;
      let friendId: string | undefined;
      const links = await database
        .get<JournalEntryFriend>('journal_entry_friends')
        .query(Q.where('journal_entry_id', entry.id))
        .fetch();

      if (links.length > 0) {
        const friend = await links[0].friend.fetch();
        friendName = friend?.name;
        friendId = friend?.id;
      }

      const memory: Memory = {
        id: `notif-${entry.id}`,
        type: 'anniversary',
        title: friendName ? `Remembering ${friendName}` : 'One Year Ago',
        description: 'From your journal',
        relatedEntryId: entry.id,
        relatedFriendName: friendName,
        relatedFriendId: friendId,
        actionLabel: 'Read Entry',
        priority: 10
      };

      return { memory, entry, friendName, friendId };

    } else {
      const reflection = await database.get<WeeklyReflection>('weekly_reflections').find(entryId);
      const memory: Memory = {
        id: `notif-${reflection.id}`,
        type: 'throwback',
        title: 'Weekly Reflection',
        description: 'From one year ago',
        relatedEntryId: reflection.id,
        actionLabel: 'Read Reflection',
        priority: 10
      };
      return { memory, entry: reflection, friendName: undefined }; // Reflections don't strictly have one friend
    }
  } catch (error) {
    console.error('Error fetching memory for notification:', error);
    return null;
  }
}

