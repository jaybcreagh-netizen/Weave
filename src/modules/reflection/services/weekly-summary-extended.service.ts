/**
 * Extended Weekly Summary Service
 * 
 * Extends the base weekly summary with additional data needed for the prompt engine:
 * - friendActivity: Per-friend weave counts for the week
 * - reconnections: Friends contacted after a significant gap
 * - weekStreak: Consecutive weeks with completed reflections
 * 
 * This can either replace your existing calculateWeeklySummary() or be merged into it.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { getAverageWeeklyWeaves } from './prompt-engine';
import { getCurrentWeekBounds } from './weekly-reflection.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FriendActivityItem {
  friendId: string;
  friendName: string;
  weaveCount: number;
  lastInteractionDate: Date;
}

export interface ReconnectionItem {
  friendId: string;
  friendName: string;
  daysSince: number;  // Days since previous contact before this week's interaction
  reconnectionDate: Date;
}

export interface ExtendedWeeklySummary {
  // Existing fields (from your current WeeklySummary)
  totalWeaves: number;
  friendsContacted: number;
  topActivity: string;
  topActivityCount: number;
  missedFriends: MissedFriend[];
  weekStartDate: Date;
  weekEndDate: Date;

  // New fields for prompt engine
  friendActivity: FriendActivityItem[];
  reconnections: ReconnectionItem[];
  weekStreak: number;

  // Optional existing fields
  comparison?: {
    weavesChange: number;
    friendsChange: number;
  };
  patterns?: {
    mostConsistentFriend?: { name: string; weaveCount: number };
    risingConnection?: { name: string };
    needsAttention?: number;
  };
  socialHealth?: {
    score: number;
  };
  averageWeeklyWeaves?: number;
}

import { MissedFriend } from './weekly-stats.service';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================



/**
 * Calculate friend activity for the week
 * Returns list of friends contacted with weave counts, sorted by count descending
 */
async function calculateFriendActivity(
  weekStart: Date,
  weekEnd: Date
): Promise<FriendActivityItem[]> {
  // Get all completed interactions this week
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
      Q.where('status', 'completed')
    )
    .fetch();

  if (interactions.length === 0) return [];

  // Get all interaction-friend links for these interactions
  const interactionIds = interactions.map(i => i.id);
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  // Build friend ID to interaction mapping
  const friendInteractions = new Map<string, { count: number; lastDate: Date }>();

  for (const link of interactionFriends) {
    const interaction = interactions.find(i => i.id === link.interactionId);
    if (!interaction) continue;

    const existing = friendInteractions.get(link.friendId);
    const interactionDate = new Date(interaction.interactionDate);

    if (existing) {
      existing.count++;
      if (interactionDate > existing.lastDate) {
        existing.lastDate = interactionDate;
      }
    } else {
      friendInteractions.set(link.friendId, {
        count: 1,
        lastDate: interactionDate,
      });
    }
  }

  // Get friend details
  const friendIds = Array.from(friendInteractions.keys());
  if (friendIds.length === 0) return [];

  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(friendIds)))
    .fetch();

  // Build result
  const result: FriendActivityItem[] = [];

  for (const friend of friends) {
    const data = friendInteractions.get(friend.id);
    if (data) {
      result.push({
        friendId: friend.id,
        friendName: friend.name,
        weaveCount: data.count,
        lastInteractionDate: data.lastDate,
      });
    }
  }

  // Sort by weave count descending
  return result.sort((a, b) => b.weaveCount - a.weaveCount);
}

/**
 * Count total unique completed interactions for the week
 */
async function countWeeklyInteractions(
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
      Q.where('status', 'completed')
    )
    .fetch();

  return interactions.length;
}

/**
 * Find reconnections - friends contacted this week after a significant gap
 * A "reconnection" is defined as contact after 14+ days of no interaction
 */
/**
 * Find reconnections - friends contacted this week after a significant gap
 * A "reconnection" is defined as contact after 14+ days of no interaction
 * Optimized to use batch queries.
 */
async function findReconnections(
  weekStart: Date,
  weekEnd: Date,
  minGapDays: number = 14
): Promise<ReconnectionItem[]> {
  // Get all completed interactions this week
  const thisWeekInteractions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
      Q.where('status', 'completed')
    )
    .fetch();

  if (thisWeekInteractions.length === 0) return [];

  // Get friend IDs from this week's interactions
  const interactionIds = thisWeekInteractions.map(i => i.id);
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  const friendIdsThisWeek = new Set<string>();
  const friendFirstInteraction = new Map<string, Date>();

  for (const link of interactionFriends) {
    friendIdsThisWeek.add(link.friendId);

    const interaction = thisWeekInteractions.find(i => i.id === link.interactionId);
    if (interaction) {
      const date = new Date(interaction.interactionDate);
      const existing = friendFirstInteraction.get(link.friendId);
      if (!existing || date < existing) {
        friendFirstInteraction.set(link.friendId, date);
      }
    }
  }

  if (friendIdsThisWeek.size === 0) return [];

  // Batch fetch previous interactions for all relevant friends
  // -------------------------------------------------------------
  const friendIdsArray = Array.from(friendIdsThisWeek);
  const beforeWeekStart = weekStart.getTime() - 1;

  // 1. Get ALL previous interaction links for these friends
  // This might be large, but usually manageable per user. 
  // If extremely large, would need chunking or raw SQL.
  const allHistoryLinks = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', Q.oneOf(friendIdsArray)))
    .fetch();

  if (allHistoryLinks.length === 0) return [];

  const allHistoryInteractionIds = allHistoryLinks.map(l => l.interactionId);

  // 2. Fetch the interactions themselves (filtered by date < weekStart)
  const historyInteractions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('id', Q.oneOf(allHistoryInteractionIds)),
      Q.where('interaction_date', Q.lt(beforeWeekStart)),
      Q.where('status', 'completed'),
      Q.sortBy('interaction_date', Q.desc)
      // We can't use take(1) per friend here easily with standard queries, 
      // so we fetch history and filter in memory.
    )
    .fetch();

  // Map interactionId -> Interaction
  const historyMap = new Map<string, InteractionModel>();
  historyInteractions.forEach(i => historyMap.set(i.id, i));

  // Find last interaction for each friend
  const reconnections: ReconnectionItem[] = [];

  for (const friendId of friendIdsThisWeek) {
    // Get links for this friend
    const friendLinks = allHistoryLinks.filter(l => l.friendId === friendId);

    // Find most recent interaction from history
    let lastInteractionDate: Date | null = null;

    for (const link of friendLinks) {
      const interaction = historyMap.get(link.interactionId);
      if (interaction) {
        const date = new Date(interaction.interactionDate);
        if (!lastInteractionDate || date > lastInteractionDate) {
          lastInteractionDate = date;
        }
      }
    }

    if (!lastInteractionDate) {
      // First time contact (not reconnection)
      continue;
    }

    const thisWeekFirstDate = friendFirstInteraction.get(friendId);
    if (!thisWeekFirstDate) continue;

    const daysSince = Math.floor(
      (thisWeekFirstDate.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= minGapDays) {
      // Get friend name (fetch from DB or if we have a cache)
      // We can optimize by fetching these friends in batch too if strictly needed,
      // but fetching ~3-5 reconnection friends individually is acceptable cost 
      // compared to the previous loop. Let's strict optimize though.
      const friend = await database.get<FriendModel>('friends').find(friendId);

      reconnections.push({
        friendId,
        friendName: friend.name,
        daysSince,
        reconnectionDate: thisWeekFirstDate,
      });
    }
  }

  // Sort by gap length descending (longest reconnection first)
  return reconnections.sort((a, b) => b.daysSince - a.daysSince);
}

/**
 * Calculate week streak - consecutive weeks with completed reflections
 */
async function calculateWeekStreak(): Promise<number> {
  // Get all weekly reflections, sorted by date descending
  const reflections = await database
    .get<WeeklyReflection>('weekly_reflections')
    .query(Q.sortBy('week_end_date', Q.desc))
    .fetch();

  if (reflections.length === 0) return 0;

  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  let streak = 0;

  // Check if most recent reflection is from this week or last week
  // (Allow current week to not have a reflection yet)
  const mostRecent = reflections[0];
  const weeksSinceMostRecent = Math.floor((now - mostRecent.weekEndDate) / oneWeekMs);

  // If more than 1 week since last reflection, streak is broken
  if (weeksSinceMostRecent > 1) {
    return 0;
  }

  // Count consecutive weeks
  for (let i = 0; i < reflections.length; i++) {
    const reflection = reflections[i];
    const expectedWeekEnd = now - (i * oneWeekMs);
    const difference = Math.abs(reflection.weekEndDate - expectedWeekEnd);

    // Allow 3 days of flexibility for week alignment
    if (difference < 3 * 24 * 60 * 60 * 1000) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get previous week's stats for comparison
 */
async function getPreviousWeekStats(): Promise<{ weaves: number; friends: number } | null> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get last week's bounds
  const lastWeekEnd = new Date(oneWeekAgo);
  lastWeekEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(twoWeeksAgo);
  const dayOfWeek = lastWeekStart.getDay();
  lastWeekStart.setDate(lastWeekStart.getDate() - dayOfWeek + 7); // Start of last week
  lastWeekStart.setHours(0, 0, 0, 0);

  // Get interactions from last week
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(lastWeekStart.getTime(), lastWeekEnd.getTime())),
      Q.where('status', 'completed')
    )
    .fetch();

  if (interactions.length === 0) return null;

  // Get unique friends
  const interactionIds = interactions.map(i => i.id);
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  const uniqueFriends = new Set(interactionFriends.map(link => link.friendId));

  return {
    weaves: interactions.length,
    friends: uniqueFriends.size,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate extended weekly summary with all fields needed for the prompt engine.
 * 
 * This is designed to either:
 * 1. Replace your existing calculateWeeklySummary() entirely
 * 2. Be called alongside it and merged
 * 
 * If you want option 2, you can call this and spread the results into your existing summary.
 */
export async function calculateExtendedWeeklySummary(): Promise<ExtendedWeeklySummary> {
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  // Run calculations in parallel where possible
  const [
    friendActivity,
    reconnections,
    weekStreak,
    previousWeekStats,
    averageWeeklyWeaves,
    totalWeaves,
  ] = await Promise.all([
    calculateFriendActivity(weekStart, weekEnd),
    findReconnections(weekStart, weekEnd),
    calculateWeekStreak(),
    getPreviousWeekStats(),
    getAverageWeeklyWeaves(),
    countWeeklyInteractions(weekStart, weekEnd),
  ]);

  // Calculate basic stats from friendActivity
  // const totalWeaves = friendActivity.reduce((sum, f) => sum + f.weaveCount, 0); // OLD: Counted person-interactions
  const friendsContacted = friendActivity.length;

  // Get top activity (would need interaction data - simplified here)
  // In your real implementation, you'd calculate this from interactions
  const topActivity = await getTopActivity(weekStart, weekEnd);

  // Get missed friends (friends needing attention)
  const missedFriends = await getMissedFriends();

  // Build comparison if we have previous week data
  const comparison = previousWeekStats ? {
    weavesChange: totalWeaves - previousWeekStats.weaves,
    friendsChange: friendsContacted - previousWeekStats.friends,
  } : undefined;

  // Build patterns
  const patterns = buildPatterns(friendActivity, missedFriends);

  // Calculate social health score
  const socialHealth = await calculateSocialHealth();

  return {
    totalWeaves,
    friendsContacted,
    topActivity: topActivity.activity,
    topActivityCount: topActivity.count,
    missedFriends,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    friendActivity,
    reconnections,
    weekStreak,
    comparison,
    patterns,
    socialHealth,
    averageWeeklyWeaves,
  };
}

/**
 * Get top activity for the week
 */
async function getTopActivity(
  weekStart: Date,
  weekEnd: Date
): Promise<{ activity: string; count: number }> {
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
      Q.where('status', 'completed')
    )
    .fetch();

  if (interactions.length === 0) {
    return { activity: 'None', count: 0 };
  }

  // Count activities
  const activityCounts = new Map<string, number>();

  for (const interaction of interactions) {
    const activity = interaction.activity || interaction.interactionCategory || 'Connection';
    activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
  }

  // Find top activity
  let topActivity = 'Connection';
  let topCount = 0;

  for (const [activity, count] of activityCounts) {
    if (count > topCount) {
      topActivity = activity;
      topCount = count;
    }
  }

  return { activity: topActivity, count: topCount };
}

/**
 * Get friends who need attention (low weave scores in important tiers)
 */
/**
 * Get friends who need attention (low weave scores in important tiers)
 * Optimized to batch fetch last interaction dates.
 */
async function getMissedFriends(): Promise<MissedFriend[]> {
  // Get non-dormant friends with low scores
  const friends = await database
    .get<FriendModel>('friends')
    .query(
      Q.where('is_dormant', false),
      Q.where('weave_score', Q.lt(50)), // Below 50 needs attention
      Q.sortBy('weave_score', Q.asc)
    )
    .fetch();

  if (friends.length === 0) return [];

  // Batch fetch last interactions for these friends
  // -------------------------------------------------------------
  const friendIds = friends.map(f => f.id);

  // 1. Get all interaction links for these friends
  const allLinks = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('friend_id', Q.oneOf(friendIds)))
    .fetch();

  const interactionIds = allLinks.map(l => l.interactionId);

  // 2. Fetch the actual interactions
  // NOTE: If user has minimal history, this is small. 
  // If user has huge history, filtering by date DESC and limit might be better in SQL,
  // but WatermelonDB support for complex joins is limited.
  // We'll fetch 'completed' interactions for these IDs.
  // To optimize, we probably only care about RECENT interactions (e.g. last 30 days) to confirm 'missed' state? 
  // No, we need the *absolute last*. 
  // Let's fetch them sorted by date desc.

  let interactions: InteractionModel[] = [];
  if (interactionIds.length > 0) {
    interactions = await database
      .get<InteractionModel>('interactions')
      .query(
        Q.where('id', Q.oneOf(interactionIds)),
        Q.where('status', 'completed')
      )
      .fetch();
  }

  // Map interactionId -> Interaction
  const interactionMap = new Map<string, InteractionModel>();
  interactions.forEach(i => interactionMap.set(i.id, i));

  // Determine last interaction date per friend
  const lastInteractionMap = new Map<string, Date>();

  for (const friendId of friendIds) {
    const friendLinks = allLinks.filter(l => l.friendId === friendId);
    let maxDate: Date | null = null;

    for (const link of friendLinks) {
      const interaction = interactionMap.get(link.interactionId);
      if (interaction) {
        const date = new Date(interaction.interactionDate);
        if (!maxDate || date > maxDate) {
          maxDate = date;
        }
      }
    }

    if (maxDate) {
      lastInteractionMap.set(friendId, maxDate);
    }
  }
  // -------------------------------------------------------------

  const missedFriends: MissedFriend[] = [];

  for (const friend of friends) {
    // Calculate days since last contact
    const lastInteraction = lastInteractionMap.get(friend.id);
    const daysSince = lastInteraction
      ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    missedFriends.push({
      friend,
      weaveScore: friend.weaveScore,
      daysSinceLastContact: daysSince,
      archetypeValue: getArchetypeValue(friend.archetype),
      suggestedAction: getSuggestedAction(friend.archetype, friend.dunbarTier),
    });
  }

  return missedFriends;
}

/**
 * Get the date of the last interaction with a friend
 * (Deprecated helper - kept for compatibility if needed elsewhere, but logic inlined above)
 */
async function getLastInteractionDate(friendId: string): Promise<Date | null> {
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

/**
 * Get what this archetype values in friendships
 */
function getArchetypeValue(archetype: string): string {
  const values: Record<string, string> = {
    'Emperor': 'structure and reliability',
    'Empress': 'nurturing and care',
    'HighPriestess': 'depth and intuition',
    'Fool': 'spontaneity and adventure',
    'Sun': 'joy and celebration',
    'Hermit': 'quality one-on-one time',
    'Magician': 'creativity and ideas',
    'Lovers': 'emotional connection',
  };
  return values[archetype] || 'meaningful connection';
}

/**
 * Get a suggested action based on archetype and tier
 */
function getSuggestedAction(archetype: string, tier: string): string {
  const actions: Record<string, string> = {
    'Emperor': 'Schedule a catch-up call',
    'Empress': 'Send a caring message',
    'HighPriestess': 'Share something meaningful',
    'Fool': 'Suggest a spontaneous hangout',
    'Sun': 'Celebrate something together',
    'Hermit': 'Invite them for quiet time',
    'Magician': 'Bounce an idea off them',
    'Lovers': 'Express appreciation',
  };

  const action = actions[archetype] || 'Reach out with a hello';

  // Adjust for tier
  if (tier === 'InnerCircle') {
    return action.replace('message', 'call').replace('Suggest', 'Plan');
  }

  return action;
}

/**
 * Build patterns from week data
 */
function buildPatterns(
  friendActivity: FriendActivityItem[],
  missedFriends: MissedFriend[]
): ExtendedWeeklySummary['patterns'] {
  const patterns: ExtendedWeeklySummary['patterns'] = {};

  // Most consistent friend (most weaves this week)
  if (friendActivity.length > 0 && friendActivity[0].weaveCount > 1) {
    patterns.mostConsistentFriend = {
      name: friendActivity[0].friendName,
      weaveCount: friendActivity[0].weaveCount,
    };
  }

  // Rising connection (second most contacted, if they have 2+ weaves)
  if (friendActivity.length > 1 && friendActivity[1].weaveCount >= 2) {
    patterns.risingConnection = {
      name: friendActivity[1].friendName,
    };
  }

  // Friends needing attention
  patterns.needsAttention = missedFriends.length;

  return patterns;
}

/**
 * Calculate overall social health score
 */
async function calculateSocialHealth(): Promise<{ score: number } | undefined> {
  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('is_dormant', false))
    .fetch();

  if (friends.length === 0) return undefined;

  const totalScore = friends.reduce((sum, f) => sum + f.weaveScore, 0);
  const averageScore = Math.round(totalScore / friends.length);

  return { score: averageScore };
}

// ============================================================================
// INTEGRATION HELPER
// ============================================================================

/**
 * Helper to extend an existing WeeklySummary with the new fields.
 * Use this if you want to keep your existing calculateWeeklySummary() 
 * and just add the new fields.
 * 
 * Usage:
 * const baseSummary = await calculateWeeklySummary(); // Your existing function
 * const extendedSummary = await extendWeeklySummary(baseSummary);
 */
export async function extendWeeklySummary(
  baseSummary: Omit<ExtendedWeeklySummary, 'friendActivity' | 'reconnections' | 'weekStreak'>
): Promise<ExtendedWeeklySummary> {
  const [friendActivity, reconnections, weekStreak] = await Promise.all([
    calculateFriendActivity(baseSummary.weekStartDate, baseSummary.weekEndDate),
    findReconnections(baseSummary.weekStartDate, baseSummary.weekEndDate),
    calculateWeekStreak(),
  ]);

  return {
    ...baseSummary,
    friendActivity,
    reconnections,
    weekStreak,
  };
}

// ============================================================================
// DRILL-DOWN DATA LOADERS
// ============================================================================

export interface WeaveItem {
  id: string;
  date: Date;
  friendNames: string[];
  category: string;
  title?: string;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface WeeklyBreakdown {
  weaves: WeaveItem[];
  friends: FriendActivityItem[];
  categories: CategoryBreakdown[];
}

/**
 * Get detailed breakdown data for the drill-down views
 * If weekStartDate/weekEndDate are not provided, uses current week bounds
 */
export async function getWeeklyBreakdown(
  weekStartDate?: Date,
  weekEndDate?: Date
): Promise<WeeklyBreakdown> {
  const { weekStart, weekEnd } = weekStartDate && weekEndDate
    ? { weekStart: weekStartDate, weekEnd: weekEndDate }
    : getCurrentWeekBounds();

  // Get all completed interactions this week
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.between(weekStart.getTime(), weekEnd.getTime())),
      Q.where('status', 'completed'),
      Q.sortBy('interaction_date', Q.desc)
    )
    .fetch();

  if (interactions.length === 0) {
    return { weaves: [], friends: [], categories: [] };
  }

  // Get all interaction-friend links
  const interactionIds = interactions.map(i => i.id);
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  // Get all friend IDs and fetch friend models
  const friendIds = Array.from(new Set(interactionFriends.map(link => link.friendId)));
  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(friendIds)))
    .fetch();

  const friendMap = new Map(friends.map(f => [f.id, f]));

  // Build weaves list
  const weaves: WeaveItem[] = interactions.map(interaction => {
    const linkedFriends = interactionFriends
      .filter(link => link.interactionId === interaction.id)
      .map(link => friendMap.get(link.friendId)?.name || 'Unknown')
      .filter(Boolean);

    return {
      id: interaction.id,
      date: new Date(interaction.interactionDate),
      friendNames: linkedFriends,
      category: interaction.interactionCategory || interaction.activity || 'Connection',
      title: interaction.title,
    };
  });

  // Build friends list (reuse existing function logic)
  const friendActivity = await calculateFriendActivity(weekStart, weekEnd);

  // Build category breakdown
  const categoryCounts = new Map<string, number>();
  for (const interaction of interactions) {
    const category = interaction.interactionCategory || interaction.activity || 'Connection';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const totalWeaves = interactions.length;
  const categories: CategoryBreakdown[] = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalWeaves) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    weaves,
    friends: friendActivity,
    categories,
  };
}
