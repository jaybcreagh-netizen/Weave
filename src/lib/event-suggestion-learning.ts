/**
 * Event Suggestion Learning System
 *
 * Learns from user feedback to improve calendar event suggestions over time.
 * Tracks dismissals, corrections, and patterns to become more intelligent.
 */

import { database } from '../db';
import EventSuggestionFeedback from '../db/models/EventSuggestionFeedback';
import FriendModel from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import type { ScannedEvent } from './event-scanner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SNOOZE_STORAGE_KEY = '@weave_event_suggestion_snoozes';

export interface SnoozeConfig {
  friendId?: string; // Snooze specific friend
  eventPattern?: string; // Snooze events matching pattern (e.g., "Team Lunch")
  until: number; // Timestamp when snooze expires
  type: 'friend' | 'event-pattern' | 'all';
}

export interface LearningInsights {
  // Dismissal patterns
  frequentlyDismissedFriends: string[]; // Friend IDs user often dismisses
  frequentlyDismissedEventPatterns: string[]; // Event titles user often dismisses

  // Correction patterns
  friendCorrectionRate: Record<string, number>; // How often user corrects each friend
  categoryCorrectionRate: Record<string, number>; // How often user corrects each category

  // Acceptance patterns
  preferredEventTypes: string[]; // Event types user accepts most
  preferredFriends: string[]; // Friends user accepts most

  // Overall metrics
  totalSuggestions: number;
  acceptanceRate: number;
  correctionRate: number;
  dismissalRate: number;
}

/**
 * Check if an event should be filtered based on learned patterns
 */
export async function shouldFilterEvent(event: ScannedEvent): Promise<{
  shouldFilter: boolean;
  reason?: string;
}> {
  try {
    // Check for active snoozes
    const snoozesStr = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
    if (snoozesStr) {
      const snoozes: SnoozeConfig[] = JSON.parse(snoozesStr);
      const now = Date.now();

      // Remove expired snoozes
      const activeSnoozes = snoozes.filter(s => s.until > now);
      if (activeSnoozes.length !== snoozes.length) {
        await AsyncStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(activeSnoozes));
      }

      // Check if event matches any active snooze
      for (const snooze of activeSnoozes) {
        if (snooze.type === 'all') {
          return { shouldFilter: true, reason: 'all-snoozed' };
        }

        if (snooze.type === 'friend' && snooze.friendId) {
          const friendMatch = event.matchedFriends.some(m => m.friend.id === snooze.friendId);
          if (friendMatch) {
            return { shouldFilter: true, reason: `friend-snoozed:${snooze.friendId}` };
          }
        }

        if (snooze.type === 'event-pattern' && snooze.eventPattern) {
          const patternMatch = event.title.toLowerCase().includes(snooze.eventPattern.toLowerCase());
          if (patternMatch) {
            return { shouldFilter: true, reason: `pattern-snoozed:${snooze.eventPattern}` };
          }
        }
      }
    }

    // Check dismissal history
    const dismissalCount = await database
      .get<EventSuggestionFeedback>('event_suggestion_feedback')
      .query(
        Q.where('calendar_event_id', event.id),
        Q.where('action', 'dismissed')
      )
      .fetchCount();

    if (dismissalCount >= 3) {
      return { shouldFilter: true, reason: 'frequently-dismissed' };
    }

    // Check if event title matches frequently dismissed patterns
    const recentDismissals = await database
      .get<EventSuggestionFeedback>('event_suggestion_feedback')
      .query(
        Q.where('action', 'dismissed'),
        Q.where('dismissal_reason', 'not-relevant'),
        Q.sortBy('created_at', Q.desc),
        Q.take(50)
      )
      .fetch();

    // Look for similar event titles
    const similarDismissals = recentDismissals.filter(d => {
      const similarity = calculateTitleSimilarity(d.eventTitle, event.title);
      return similarity > 0.7;
    });

    if (similarDismissals.length >= 3) {
      return { shouldFilter: true, reason: 'similar-events-dismissed' };
    }

    // Check friend dismissal patterns
    for (const match of event.matchedFriends) {
      const friendDismissals = await database
        .get<EventSuggestionFeedback>('event_suggestion_feedback')
        .query(
          Q.where('action', 'dismissed'),
          Q.where('suggested_friend_ids', Q.like(`%${match.friend.id}%`))
        )
        .fetchCount();

      const friendAcceptances = await database
        .get<EventSuggestionFeedback>('event_suggestion_feedback')
        .query(
          Q.where('action', Q.oneOf(['accepted', 'corrected'])),
          Q.where('suggested_friend_ids', Q.like(`%${match.friend.id}%`))
        )
        .fetchCount();

      const totalFriendSuggestions = friendDismissals + friendAcceptances;
      if (totalFriendSuggestions >= 5 && friendDismissals / totalFriendSuggestions > 0.8) {
        return { shouldFilter: true, reason: `friend-low-acceptance:${match.friend.id}` };
      }
    }

    return { shouldFilter: false };
  } catch (error) {
    console.error('[Learning] Error checking filters:', error);
    return { shouldFilter: false };
  }
}

/**
 * Detect if event has ambiguous title that needs friend selection
 */
export function isAmbiguousEvent(event: ScannedEvent): boolean {
  const ambiguousPatterns = [
    /\b(friends?|team|group|everyone|folks|gang|crew|squad)\b/i,
    /\b(dinner|lunch|coffee|drinks?) party\b/i,
    /\b(happy hour|get-together|hangout|meetup)\b/i,
  ];

  // Check if title matches ambiguous patterns
  const hasAmbiguousPattern = ambiguousPatterns.some(pattern =>
    pattern.test(event.title)
  );

  // And has no specific friend matches
  const hasNoMatches = event.matchedFriends.length === 0;

  return hasAmbiguousPattern && hasNoMatches;
}

/**
 * Record user feedback for a suggestion
 */
export async function recordFeedback(params: {
  event: ScannedEvent;
  action: 'accepted' | 'dismissed' | 'corrected' | 'snoozed';
  dismissalReason?: 'wrong-friends' | 'not-social' | 'already-logged' | 'not-relevant';
  correctedFriendIds?: string[];
  correctedCategory?: string;
  snoozeConfig?: SnoozeConfig;
  emotionalRating?: number;
  reflectionNotes?: string;
  resultingInteractionId?: string;
}): Promise<void> {
  const {
    event,
    action,
    dismissalReason,
    correctedFriendIds,
    correctedCategory,
    snoozeConfig,
    emotionalRating,
    reflectionNotes,
    resultingInteractionId,
  } = params;

  try {
    await database.write(async () => {
      await database.get<EventSuggestionFeedback>('event_suggestion_feedback').create((feedback) => {
        feedback.calendarEventId = event.id;
        feedback.eventTitle = event.title;
        feedback.eventDate = event.startDate;
        feedback.eventLocation = event.location;

        feedback.suggestedFriendIds = event.matchedFriends.map(m => m.friend.id);
        feedback.suggestedCategory = event.suggestedCategory;

        feedback.action = action;
        feedback.dismissalReason = dismissalReason;

        feedback.correctedFriendIds = correctedFriendIds;
        feedback.correctedCategory = correctedCategory;

        if (snoozeConfig) {
          feedback.snoozedUntil = new Date(snoozeConfig.until);
          feedback.snoozeType = snoozeConfig.type;
          if (snoozeConfig.friendId) {
            feedback.snoozedFriendIds = [snoozeConfig.friendId];
          }
        }

        feedback.emotionalRating = emotionalRating;
        feedback.reflectionNotes = reflectionNotes;
        feedback.resultingInteractionId = resultingInteractionId;

        // Calculate confidence and match quality
        feedback.confidenceScore = event.confidence;
        feedback.matchQuality = event.matchedFriends.length > 0
          ? event.matchedFriends.reduce((sum, m) => sum + m.confidence, 0) / event.matchedFriends.length
          : 0;

        feedback.suggestedAt = new Date();
        feedback.respondedAt = new Date();
      });
    });

    // If snoozing, store in AsyncStorage for quick access
    if (action === 'snoozed' && snoozeConfig) {
      const snoozesStr = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
      const snoozes: SnoozeConfig[] = snoozesStr ? JSON.parse(snoozesStr) : [];
      snoozes.push(snoozeConfig);
      await AsyncStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));
    }

    console.log(`[Learning] Recorded ${action} feedback for event: ${event.title}`);
  } catch (error) {
    console.error('[Learning] Error recording feedback:', error);
  }
}

/**
 * Get learning insights from historical feedback
 */
export async function getLearningInsights(): Promise<LearningInsights> {
  try {
    const allFeedback = await database
      .get<EventSuggestionFeedback>('event_suggestion_feedback')
      .query()
      .fetch();

    const totalSuggestions = allFeedback.length;
    const accepted = allFeedback.filter(f => f.action === 'accepted').length;
    const corrected = allFeedback.filter(f => f.action === 'corrected').length;
    const dismissed = allFeedback.filter(f => f.action === 'dismissed').length;

    // Analyze dismissal patterns
    const dismissedFeedback = allFeedback.filter(f => f.action === 'dismissed');
    const friendDismissalCounts: Record<string, number> = {};
    const eventPatternDismissalCounts: Record<string, number> = {};

    for (const feedback of dismissedFeedback) {
      // Track friend dismissals
      for (const friendId of feedback.suggestedFriendIds) {
        friendDismissalCounts[friendId] = (friendDismissalCounts[friendId] || 0) + 1;
      }

      // Track event pattern dismissals
      const pattern = extractEventPattern(feedback.eventTitle);
      if (pattern) {
        eventPatternDismissalCounts[pattern] = (eventPatternDismissalCounts[pattern] || 0) + 1;
      }
    }

    // Analyze correction patterns
    const correctedFeedback = allFeedback.filter(f => f.action === 'corrected');
    const friendCorrectionCounts: Record<string, number> = {};
    const categoryCorrectionCounts: Record<string, number> = {};

    for (const feedback of correctedFeedback) {
      if (feedback.correctedFriendIds && feedback.correctedFriendIds.length > 0) {
        for (const friendId of feedback.suggestedFriendIds) {
          if (!feedback.correctedFriendIds.includes(friendId)) {
            friendCorrectionCounts[friendId] = (friendCorrectionCounts[friendId] || 0) + 1;
          }
        }
      }

      if (feedback.correctedCategory && feedback.correctedCategory !== feedback.suggestedCategory) {
        const originalCategory = feedback.suggestedCategory || 'unknown';
        categoryCorrectionCounts[originalCategory] = (categoryCorrectionCounts[originalCategory] || 0) + 1;
      }
    }

    // Calculate rates
    const friendCorrectionRate: Record<string, number> = {};
    for (const friendId in friendCorrectionCounts) {
      const totalForFriend = allFeedback.filter(f =>
        f.suggestedFriendIds.includes(friendId)
      ).length;
      friendCorrectionRate[friendId] = friendCorrectionCounts[friendId] / totalForFriend;
    }

    const categoryCorrectionRate: Record<string, number> = {};
    for (const category in categoryCorrectionCounts) {
      const totalForCategory = allFeedback.filter(f =>
        f.suggestedCategory === category
      ).length;
      categoryCorrectionRate[category] = categoryCorrectionCounts[category] / totalForCategory;
    }

    // Find frequently dismissed friends/patterns (>50% dismissal rate with at least 3 suggestions)
    const frequentlyDismissedFriends = Object.entries(friendDismissalCounts)
      .filter(([friendId, count]) => {
        const total = allFeedback.filter(f => f.suggestedFriendIds.includes(friendId)).length;
        return total >= 3 && count / total > 0.5;
      })
      .map(([friendId]) => friendId);

    const frequentlyDismissedEventPatterns = Object.entries(eventPatternDismissalCounts)
      .filter(([pattern, count]) => count >= 3)
      .map(([pattern]) => pattern);

    // Analyze acceptance patterns
    const acceptedFeedback = allFeedback.filter(f => f.action === 'accepted' || f.action === 'corrected');
    const friendAcceptanceCounts: Record<string, number> = {};
    const eventTypeAcceptanceCounts: Record<string, number> = {};

    for (const feedback of acceptedFeedback) {
      for (const friendId of feedback.suggestedFriendIds) {
        friendAcceptanceCounts[friendId] = (friendAcceptanceCounts[friendId] || 0) + 1;
      }

      const eventType = extractEventPattern(feedback.eventTitle);
      if (eventType) {
        eventTypeAcceptanceCounts[eventType] = (eventTypeAcceptanceCounts[eventType] || 0) + 1;
      }
    }

    const preferredFriends = Object.entries(friendAcceptanceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([friendId]) => friendId);

    const preferredEventTypes = Object.entries(eventTypeAcceptanceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    return {
      frequentlyDismissedFriends,
      frequentlyDismissedEventPatterns,
      friendCorrectionRate,
      categoryCorrectionRate,
      preferredEventTypes,
      preferredFriends,
      totalSuggestions,
      acceptanceRate: totalSuggestions > 0 ? accepted / totalSuggestions : 0,
      correctionRate: totalSuggestions > 0 ? corrected / totalSuggestions : 0,
      dismissalRate: totalSuggestions > 0 ? dismissed / totalSuggestions : 0,
    };
  } catch (error) {
    console.error('[Learning] Error getting insights:', error);
    return {
      frequentlyDismissedFriends: [],
      frequentlyDismissedEventPatterns: [],
      friendCorrectionRate: {},
      categoryCorrectionRate: {},
      preferredEventTypes: [],
      preferredFriends: [],
      totalSuggestions: 0,
      acceptanceRate: 0,
      correctionRate: 0,
      dismissalRate: 0,
    };
  }
}

/**
 * Calculate similarity between two event titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/));
  const words2 = new Set(title2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Extract a normalized event pattern from title
 */
function extractEventPattern(title: string): string | null {
  // Remove dates, times, and common noise words
  let pattern = title.toLowerCase()
    .replace(/\d+:\d+\s*(am|pm)?/gi, '')
    .replace(/\b(at|on|in|with|for)\b/gi, '')
    .trim();

  // Remove names (simple heuristic: capitalized words)
  pattern = pattern.split(' ')
    .filter(word => word === word.toLowerCase())
    .join(' ')
    .trim();

  return pattern.length > 0 ? pattern : null;
}

/**
 * Clear all snoozes (for testing or user request)
 */
export async function clearAllSnoozes(): Promise<void> {
  await AsyncStorage.removeItem(SNOOZE_STORAGE_KEY);
  console.log('[Learning] Cleared all snoozes');
}

/**
 * Get active snoozes
 */
export async function getActiveSnoozes(): Promise<SnoozeConfig[]> {
  const snoozesStr = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
  if (!snoozesStr) return [];

  const snoozes: SnoozeConfig[] = JSON.parse(snoozesStr);
  const now = Date.now();

  return snoozes.filter(s => s.until > now);
}
