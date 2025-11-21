/**
 * Narrative Generation Utilities
 *
 * Generates human-readable, conversational text from data
 * Tone: Mix of therapist (supportive, validating) and coach (actionable, clear)
 */

import { SocialSeason } from '@/lib/social-season/season-types';
import { Suggestion } from '@/types/suggestions';
import FriendModel from '@/db/models/Friend';
import { calculateCurrentScore } from '@/modules/intelligence';
import { differenceInDays } from 'date-fns';

// ============================================================================
// TODAY'S FOCUS - Contextual Intro Lines
// ============================================================================

export interface TodaysFocusContext {
  batteryLevel: number; // 1-5
  upcomingPlansCount: number;
  criticalSuggestions: number;
  season: SocialSeason;
  hasRecentActivity: boolean; // Weaved in last 3 days
}

/**
 * Generates a contextual opening line for Today's Focus widget
 * Changes based on battery, season, and current state
 */
export function generateTodaysFocusIntro(context: TodaysFocusContext): string {
  const { batteryLevel, upcomingPlansCount, criticalSuggestions, season, hasRecentActivity } = context;

  // CRITICAL situations take priority
  if (criticalSuggestions > 0) {
    return `${criticalSuggestions} ${criticalSuggestions === 1 ? 'friend needs' : 'friends need'} your attention today.`;
  }

  // LOW BATTERY + PLANS = Potential overwhelm
  if (batteryLevel <= 2 && upcomingPlansCount > 0) {
    return `You have ${upcomingPlansCount} ${upcomingPlansCount === 1 ? 'plan' : 'plans'} coming up. Your energy is low—honor your limits.`;
  }

  // LOW BATTERY + REST SEASON = Validate rest
  if (batteryLevel <= 2 && season === 'resting') {
    return "You're in rest mode. No pressure today—just gentle reminders.";
  }

  // HIGH BATTERY + BLOOM = Encourage action
  if (batteryLevel >= 4 && season === 'blooming') {
    return `Your energy is high. ${upcomingPlansCount > 0 ? `${upcomingPlansCount} ${upcomingPlansCount === 1 ? 'plan' : 'plans'} ahead, plus some ideas for you.` : 'Ready to connect?'}`;
  }

  // UPCOMING PLANS
  if (upcomingPlansCount > 0) {
    return `${upcomingPlansCount} ${upcomingPlansCount === 1 ? 'plan' : 'plans'} on the horizon. A few thoughts for you.`;
  }

  // RECENT ACTIVITY
  if (hasRecentActivity) {
    return "You've been actively weaving. Here's what to keep in mind.";
  }

  // BALANCED/DEFAULT
  return 'A few things on your mind today.';
}

// ============================================================================
// SOCIAL SEASON - Data-Driven Explanations
// ============================================================================

export interface SeasonExplanationData {
  season: SocialSeason;
  weavesLast7Days: number;
  weavesLast30Days: number;
  avgScoreAllFriends: number;
  avgScoreInnerCircle: number;
  momentumCount: number;
  batteryLast7DaysAvg: number;
  batteryTrend: 'rising' | 'falling' | 'stable';
}

/**
 * Generates "why am I in this season" explanation with supporting data
 */
export function generateSeasonExplanation(data: SeasonExplanationData): {
  headline: string;
  reasons: string[];
  insight: string;
} {
  const { season, weavesLast7Days, batteryLast7DaysAvg, batteryTrend, avgScoreInnerCircle, momentumCount } = data;

  const reasons: string[] = [];

  // Build data-driven reasons
  if (weavesLast7Days === 0) {
    reasons.push('No weaves this week');
  } else if (weavesLast7Days >= 5) {
    reasons.push(`${weavesLast7Days} weaves this week—high activity`);
  } else if (weavesLast7Days >= 2) {
    reasons.push(`${weavesLast7Days} weaves this week`);
  }

  // Battery context
  if (batteryLast7DaysAvg <= 2) {
    reasons.push('Social battery averaging low');
  } else if (batteryLast7DaysAvg >= 4) {
    reasons.push('Social battery running high');
  }

  if (batteryTrend === 'falling') {
    reasons.push('Energy has been dropping');
  } else if (batteryTrend === 'rising') {
    reasons.push('Energy has been climbing');
  }

  // Inner circle health
  if (avgScoreInnerCircle < 50) {
    reasons.push('Inner circle needs attention');
  } else if (avgScoreInnerCircle > 75) {
    reasons.push('Inner circle thriving');
  }

  // Momentum
  if (momentumCount > 0) {
    reasons.push(`${momentumCount} ${momentumCount === 1 ? 'friendship' : 'friendships'} in flow state`);
  }

  // Generate season-specific insights
  let headline = '';
  let insight = '';

  switch (season) {
    case 'resting':
      headline = "You're in Resting Season";
      insight = "Your patterns show you need recovery time. This is natural and temporary. Your friendships hold strong even when you need space.";
      break;
    case 'balanced':
      headline = "You're in Balanced Season";
      insight = "You're in a sustainable rhythm—connecting mindfully while honoring your energy. This consistency is something to celebrate.";
      break;
    case 'blooming':
      headline = "You're in Blooming Season";
      insight = "Your energy is high and connections are flowing. Enjoy this wave, but remember to check in with yourself to avoid burnout.";
      break;
  }

  return {
    headline,
    reasons: reasons.slice(0, 4), // Max 4 reasons
    insight,
  };
}

// ============================================================================
// FRIEND RHYTHM CONTEXT
// ============================================================================

/**
 * Calculates a friend's typical connection rhythm based on history
 * Returns average days between interactions
 */
export async function calculateFriendRhythm(
  friend: FriendModel,
  recentInteractions: Array<{ interactionDate: Date }>
): Promise<{
  averageDays: number | null;
  isDeviation: boolean; // Current gap exceeds typical rhythm
  deviationDays: number | null;
}> {
  if (recentInteractions.length < 2) {
    return { averageDays: null, isDeviation: false, deviationDays: null };
  }

  // Calculate gaps between consecutive interactions
  const gaps: number[] = [];
  const sortedInteractions = [...recentInteractions].sort(
    (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
  );

  for (let i = 0; i < sortedInteractions.length - 1; i++) {
    const gap = differenceInDays(sortedInteractions[i].interactionDate, sortedInteractions[i + 1].interactionDate);
    gaps.push(gap);
  }

  const averageDays = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
  const currentGap = differenceInDays(new Date(), sortedInteractions[0].interactionDate);
  const isDeviation = currentGap > averageDays * 1.5; // 50% longer than usual
  const deviationDays = isDeviation ? currentGap - averageDays : null;

  return {
    averageDays,
    isDeviation,
    deviationDays,
  };
}

/**
 * Generates conversational rhythm explanation for suggestions
 */
export function generateRhythmExplanation(rhythm: {
  averageDays: number | null;
  isDeviation: boolean;
  deviationDays: number | null;
}): string {
  if (!rhythm.averageDays) {
    return 'Time to reconnect.';
  }

  if (rhythm.isDeviation && rhythm.deviationDays) {
    const avgDisplay = rhythm.averageDays === 7 ? 'weekly' :
                       rhythm.averageDays < 7 ? `every ${rhythm.averageDays} days` :
                       rhythm.averageDays === 14 ? 'biweekly' :
                       `every ${Math.round(rhythm.averageDays / 7)} weeks`;

    return `You usually connect ${avgDisplay}. It's been ${rhythm.deviationDays} days longer than usual.`;
  }

  return `Your usual rhythm is every ${rhythm.averageDays} days.`;
}

// ============================================================================
// ENHANCED SUGGESTION DESCRIPTIONS
// ============================================================================

/**
 * Enhances a suggestion with additional context and "why"
 */
export function enhanceSuggestionDescription(
  suggestion: Suggestion,
  friend: FriendModel,
  rhythm?: {
    averageDays: number | null;
    isDeviation: boolean;
    deviationDays: number | null;
  }
): string {
  const baseSubtitle = suggestion.subtitle;
  const currentScore = calculateCurrentScore(friend);

  // Add rhythm context for drift/reconnect suggestions
  if (suggestion.category === 'drift' && rhythm) {
    const rhythmText = generateRhythmExplanation(rhythm);
    return `${baseSubtitle} ${rhythmText}`;
  }

  // Add score context for critical situations
  if (suggestion.urgency === 'critical' && currentScore < 40) {
    return `${baseSubtitle} Connection is fading—time to reach out.`;
  }

  // Add momentum context for deepen suggestions
  if (suggestion.category === 'deepen') {
    return `${baseSubtitle} You're in a flow state with them—keep it going.`;
  }

  // Life events get context
  if (suggestion.category === 'life-event') {
    return `${baseSubtitle} They'll appreciate you remembering.`;
  }

  // Default: return original
  return baseSubtitle;
}

// ============================================================================
// BATTERY-AWARE TONE ADJUSTMENTS
// ============================================================================

/**
 * Adjusts tone based on user's current battery level
 * Low battery = gentler, more validating language
 * High battery = more energizing, action-oriented language
 */
export function adjustToneForBattery(text: string, batteryLevel: number): string {
  if (batteryLevel <= 2) {
    // Soften language for low battery
    return text
      .replace(/should/gi, 'could')
      .replace(/need to/gi, 'might want to')
      .replace(/must/gi, 'consider');
  }

  return text;
}
