import { startOfWeek, startOfDay } from 'date-fns';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import Friend from '../db/models/Friend';

/**
 * Weaving Insights Generator
 *
 * Transforms quantitative data into qualitative, human-readable narratives
 * that celebrate the user's weaving practice without creating anxiety.
 *
 * Philosophy: "No numbers, all feeling"
 */

export interface WeeklyInsight {
  summary: string; // Main narrative about the week
  reflectionAcknowledgment?: string; // Optional: celebrates reflections
}

// ============================================================================
// DEPTH ANALYSIS
// ============================================================================

interface DepthAnalysis {
  deepCount: number; // Heart-to-heart, deep talk, etc.
  meaningfulCount: number; // Meals, events, activities
  casualCount: number; // Hangouts, games
  quickCount: number; // Texts, calls
}

/**
 * Analyze interaction depth by category
 */
function analyzeDepth(interactions: Interaction[]): DepthAnalysis {
  const analysis: DepthAnalysis = {
    deepCount: 0,
    meaningfulCount: 0,
    casualCount: 0,
    quickCount: 0,
  };

  const deepCategories = ['deep-talk'];
  const meaningfulCategories = ['meal-drink', 'event-party', 'activity-hobby'];
  const casualCategories = ['hangout', 'movie-tv'];
  const quickCategories = ['text-call'];

  for (const interaction of interactions) {
    const category = interaction.interactionCategory;
    if (!category) continue;

    if (deepCategories.includes(category)) {
      analysis.deepCount++;
    } else if (meaningfulCategories.includes(category)) {
      analysis.meaningfulCount++;
    } else if (casualCategories.includes(category)) {
      analysis.casualCount++;
    } else if (quickCategories.includes(category)) {
      analysis.quickCount++;
    }
  }

  return analysis;
}

/**
 * Generate qualitative description of interaction depth
 * Instead of "Depth Score: 7.2", returns human narrative
 */
function generateDepthNarrative(analysis: DepthAnalysis): string {
  const total = analysis.deepCount + analysis.meaningfulCount + analysis.casualCount + analysis.quickCount;

  if (total === 0) return '';

  // High depth week (3+ deep interactions or 50%+ deep/meaningful)
  if (
    analysis.deepCount >= 3 ||
    (analysis.deepCount + analysis.meaningfulCount) / total >= 0.5
  ) {
    const phrases = [
      'Your connections had a quality of depth and presence',
      'filled with deep and meaningful moments',
      'marked by profound conversations and genuine presence',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Balanced week
  if (analysis.deepCount >= 1 && analysis.casualCount >= 1) {
    const phrases = [
      'balanced mix of meaningful presence and lighthearted joy',
      'beautifully balanced between depth and lightness',
      'a harmonious blend of deep connection and easy joy',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Social/celebratory week
  if (analysis.meaningfulCount >= analysis.deepCount * 2) {
    const phrases = [
      'alive with celebration and community',
      'filled with joyful gatherings and shared experiences',
      'vibrant with social energy and connection',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Intimate week
  if (analysis.deepCount > 0 || (analysis.casualCount + analysis.quickCount) / total >= 0.7) {
    const phrases = [
      'marked by quiet, intimate conversations',
      'intimate and intentional',
      'focused on quality over quantity',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Default: gentle presence
  return 'filled with gentle moments of connection';
}

// ============================================================================
// TIER DISTRIBUTION ANALYSIS
// ============================================================================

interface TierDistribution {
  inner: number;
  close: number;
  community: number;
}

/**
 * Analyze which Dunbar tiers received attention
 */
async function analyzeTierDistribution(
  interactions: Interaction[]
): Promise<TierDistribution> {
  const distribution: TierDistribution = {
    inner: 0,
    close: 0,
    community: 0,
  };

  for (const interaction of interactions) {
    // Get friends for this interaction
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query(Q.where('interaction_id', interaction.id))
      .fetch();

    for (const ifriend of interactionFriends) {
      const friend = await database.get<Friend>('friends').find(ifriend.friendId);

      if (friend.dunbarTier === 'InnerCircle') {
        distribution.inner++;
      } else if (friend.dunbarTier === 'CloseFriends') {
        distribution.close++;
      } else if (friend.dunbarTier === 'Community') {
        distribution.community++;
      }
    }
  }

  return distribution;
}

/**
 * Generate qualitative description of tier focus
 * Instead of "60% Inner Circle", returns human narrative
 */
function generateTierNarrative(distribution: TierDistribution): string {
  const total = distribution.inner + distribution.close + distribution.community;
  if (total === 0) return '';

  const innerPct = distribution.inner / total;
  const closePct = distribution.close / total;

  if (innerPct >= 0.6) {
    return 'focused energy on your closest bonds';
  } else if (closePct >= 0.5) {
    return 'nurtured your broader circle of close friends';
  } else if (distribution.community >= distribution.inner + distribution.close) {
    return 'wove connections across your wider community';
  } else {
    return 'wove threads across your inner circle and close friends';
  }
}

// ============================================================================
// REFLECTION ACKNOWLEDGMENT
// ============================================================================

/**
 * Generate acknowledgment for reflections
 * Instead of "Reflection Rate: 80%", returns celebration
 */
function generateReflectionAcknowledgment(reflectionCount: number): string | undefined {
  if (reflectionCount === 0) return undefined;

  if (reflectionCount === 1) {
    return 'You also took a thoughtful moment for reflection.';
  } else if (reflectionCount <= 2) {
    return 'You also took a few quiet moments for reflection.';
  } else if (reflectionCount <= 4) {
    return 'You also took several quiet moments for reflection.';
  } else if (reflectionCount <= 6) {
    return 'You also took many mindful pauses to reflect.';
  } else {
    return 'You showed deep commitment to self-awareness this week.';
  }
}

// ============================================================================
// MAIN INSIGHT GENERATOR
// ============================================================================

/**
 * Generate weekly insight for "Your Weaving Practice" widget
 * Returns qualitative narrative instead of metrics
 *
 * Analyzes Monday-Sunday of current week
 */
export async function generateWeeklyInsight(): Promise<WeeklyInsight> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = new Date();

  // Get this week's completed interactions
  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('interaction_date', Q.gte(weekStart.getTime())),
      Q.where('interaction_date', Q.lte(weekEnd.getTime())),
      Q.sortBy('interaction_date', Q.desc)
    )
    .fetch();

  const weaveCount = interactions.length;

  // Count reflections (interactions with notes OR vibe)
  const reflectionCount = interactions.filter(
    i => (i.note && i.note.trim().length > 0) || i.vibe
  ).length;

  // If no weaves this week
  if (weaveCount === 0) {
    return {
      summary: "Take a moment to weave a thread this week. Your connections are waiting to be nurtured.",
    };
  }

  // Analyze depth and tier distribution
  const depthAnalysis = analyzeDepth(interactions);
  const tierDistribution = await analyzeTierDistribution(interactions);

  // Build narrative
  const depthNarrative = generateDepthNarrative(depthAnalysis);
  const tierNarrative = generateTierNarrative(tierDistribution);

  // Count descriptor
  let countPhrase = '';
  if (weaveCount === 1) {
    countPhrase = 'you wove a thread';
  } else if (weaveCount === 2) {
    countPhrase = 'you wove a couple of threads';
  } else if (weaveCount <= 4) {
    countPhrase = `you wove ${weaveCount} threads`;
  } else if (weaveCount <= 7) {
    countPhrase = `you wove several threads`;
  } else {
    countPhrase = `you wove many threads`;
  }

  // Highlight special interactions (3+ deep talks)
  let specialMoment = '';
  if (depthAnalysis.deepCount >= 3) {
    specialMoment = ` ${depthAnalysis.deepCount === 3 ? 'Three' : 'Several'} heart-to-heart moments stood out.`;
  } else if (depthAnalysis.deepCount >= 1) {
    specialMoment = depthAnalysis.deepCount === 1
      ? ' A heart-to-heart moment stood out.'
      : ' A couple of heart-to-heart moments stood out.';
  }

  // Assemble summary
  const summary = `This week, ${countPhrase} ${tierNarrative}. Your connections were ${depthNarrative}.${specialMoment}`;

  // Add reflection acknowledgment
  const reflectionAcknowledgment = generateReflectionAcknowledgment(reflectionCount);

  return {
    summary,
    reflectionAcknowledgment,
  };
}

/**
 * Get simple week count for compact display
 * Returns actual number for "This week: X" stat
 */
export async function getThisWeekCount(): Promise<number> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = new Date();

  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('interaction_date', Q.gte(weekStart.getTime())),
      Q.where('interaction_date', Q.lte(weekEnd.getTime()))
    )
    .fetch();

  return interactions.length;
}
