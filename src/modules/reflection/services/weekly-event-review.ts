/**
 * Weekly Event Review System
 *
 * Scans past week's calendar events and presents them during weekly reflection
 * for mindful, batched logging. Integrates with learning system to filter noise.
 */

import { database } from '@/db';
import InteractionModel from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import {
  scanCalendarEvents,
  type ScannedEvent,
} from '@/modules/interactions/services/event-scanner';
import {
  shouldFilterEvent,
  isAmbiguousEvent,
  recordFeedback,
} from '@/modules/interactions/services/event-suggestion-learning.service';
import * as CalendarService from '@/modules/interactions/services/calendar.service';
import Logger from '@/shared/utils/Logger';

import InteractionFriend from '@/db/models/InteractionFriend';

export interface WeeklyEventReview {
  events: ScannedEvent[];
  totalScanned: number;
  filteredCount: number; // Events filtered by learning
  ambiguousCount: number; // Events needing friend selection
}

/**
 * Scan past week for unlogged calendar events
 * Called when user opens weekly reflection
 */
export async function scanWeekForUnloggedEvents(): Promise<WeeklyEventReview> {
  try {
    // Check if calendar integration is enabled
    const calendarSettings = await CalendarService.getCalendarSettings();
    if (!calendarSettings.enabled || !calendarSettings.twoWaySync) {
      Logger.info('[WeeklyReview] Calendar sync disabled');
      return {
        events: [],
        totalScanned: 0,
        filteredCount: 0,
        ambiguousCount: 0,
      };
    }

    // Calculate date range (past 7 days)
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    Logger.info('[WeeklyReview] Scanning events from', weekAgo, 'to', now);

    // Scan calendar
    const scanResult = await scanCalendarEvents({
      startDate: weekAgo,
      endDate: now,
      includeWeaveEvents: false,
      minImportance: 'medium',
    });

    Logger.info(`[WeeklyReview] Found ${scanResult.totalScanned} events, ${scanResult.matchedEvents} with friend matches`);

    // Filter to only events with friend matches
    const candidateEvents = scanResult.events.filter(e => e.matchedFriends.length > 0);

    // Batch fetch data for "already logged" check
    // ---------------------------------------------------------
    // 1. Get all completed interactions for the entire scan window (+/- buffer)
    // We scan from weekAgo to now. Events could be logged +/- 3 hours.
    const queryStart = weekAgo.getTime() - (3 * 60 * 60 * 1000);
    const queryEnd = now.getTime() + (3 * 60 * 60 * 1000);

    const existingInteractions = await database
      .get<InteractionModel>('interactions')
      .query(
        Q.where('interaction_date', Q.between(queryStart, queryEnd)),
        Q.where('status', 'completed')
      )
      .fetch();

    // 2. Get all friend links for these interactions
    const interactionIds = existingInteractions.map(i => i.id);
    let interactionFriendMap = new Map<string, Set<string>>();

    if (interactionIds.length > 0) {
      // Fetch in chunks if too many (WatermelonDB/SQLite limit safety)
      const chunkedIds = [];
      const CHUNK_SIZE = 500;
      for (let i = 0; i < interactionIds.length; i += CHUNK_SIZE) {
        chunkedIds.push(interactionIds.slice(i, i + CHUNK_SIZE));
      }

      const allLinks = [];
      for (const chunk of chunkedIds) {
        const links = await database
          .get<InteractionFriend>('interaction_friends')
          .query(Q.where('interaction_id', Q.oneOf(chunk)))
          .fetch();
        allLinks.push(...links);
      }

      // Build map: interactionId -> Set<friendId>
      for (const link of allLinks) {
        if (!interactionFriendMap.has(link.interactionId)) {
          interactionFriendMap.set(link.interactionId, new Set());
        }
        interactionFriendMap.get(link.interactionId)?.add(link.friendId);
      }
    }

    // Pre-process interactions for faster time-based lookup
    // Sort by time for binary search or just simple iteration (list is likely small enough)
    const sortedInteractions = existingInteractions.sort((a, b) => a.interactionDate.getTime() - b.interactionDate.getTime());
    // ---------------------------------------------------------

    // Check if already logged (IN MEMORY)
    const unloggedEvents: ScannedEvent[] = [];
    for (const event of candidateEvents) {
      const isLogged = isEventAlreadyLoggedInMemory(event, sortedInteractions, interactionFriendMap);
      if (!isLogged) {
        unloggedEvents.push(event);
      }
    }

    Logger.debug(`[WeeklyReview] ${unloggedEvents.length} unlogged events`);

    // Apply learning filters
    const filteredEvents: ScannedEvent[] = [];
    let filteredCount = 0;
    let ambiguousCount = 0;

    for (const event of unloggedEvents) {
      // Check learning filters
      const filterResult = await shouldFilterEvent(event);
      if (filterResult.shouldFilter) {
        Logger.debug(`[WeeklyReview] Filtered event "${event.title}": ${filterResult.reason}`);
        filteredCount++;
        continue;
      }

      // Check if ambiguous (needs friend selection)
      if (isAmbiguousEvent(event)) {
        ambiguousCount++;
        // Still include it but mark it
        event.extractedNames = ['(needs selection)']; // Flag for UI
      }

      filteredEvents.push(event);
    }

    Logger.info(`[WeeklyReview] Final: ${filteredEvents.length} events, ${filteredCount} filtered, ${ambiguousCount} ambiguous`);

    return {
      events: filteredEvents,
      totalScanned: scanResult.totalScanned,
      filteredCount,
      ambiguousCount,
    };
  } catch (error) {
    Logger.error('[WeeklyReview] Error scanning week:', error);
    return {
      events: [],
      totalScanned: 0,
      filteredCount: 0,
      ambiguousCount: 0,
    };
  }
}

/**
 * Check if a calendar event has already been logged as an interaction (In-Memory Version)
 */
function isEventAlreadyLoggedInMemory(
  event: ScannedEvent,
  sortedInteractions: InteractionModel[],
  interactionFriendMap: Map<string, Set<string>>
): boolean {
  try {
    // Check if any interaction exists for this event's friends around the same time
    // Look for interactions within +/- 3 hours of event time
    const eventTime = event.startDate.getTime();
    const threeHours = 3 * 60 * 60 * 1000;
    const startWindow = eventTime - threeHours;
    const endWindow = eventTime + threeHours;

    const eventFriendIds = event.matchedFriends.map(m => m.friend.id);
    if (eventFriendIds.length === 0) return false;

    // Filter candidate interactions by time window (in memory)
    // Since list is sorted, we could optimize, but simple filter is fine for <1000 items
    const candidates = sortedInteractions.filter(i =>
      i.interactionDate.getTime() >= startWindow && i.interactionDate.getTime() <= endWindow
    );

    // Check if any candidate interaction involves these friends
    for (const interaction of candidates) {
      const interactionFriendIds = interactionFriendMap.get(interaction.id);
      if (!interactionFriendIds) continue;

      // If any of the event's friends are in this interaction, consider it logged
      const hasOverlap = eventFriendIds.some(id => interactionFriendIds.has(id));
      if (hasOverlap) {
        Logger.debug(`[WeeklyReview] Event "${event.title}" already logged as interaction ${interaction.id}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    Logger.error('[WeeklyReview] Error checking if event logged:', error);
    return false; // Err on side of showing suggestion
  }
}

/**
 * Batch log multiple calendar events as interactions
 * Called when user selects events in weekly reflection
 */
export async function batchLogCalendarEvents(params: {
  events: ScannedEvent[];
  emotionalRating?: number; // Overall rating for the week
  reflectionNotes?: string; // Overall notes
}): Promise<{
  success: boolean;
  loggedCount: number;
  errors: number;
  interactionIds: string[];
}> {
  const { events, emotionalRating, reflectionNotes } = params;
  const result = {
    success: true,
    loggedCount: 0,
    errors: 0,
    interactionIds: [] as string[],
  };

  try {
    for (const event of events) {
      try {
        await database.write(async () => {
          // Create interaction
          const interaction = await database.get<InteractionModel>('interactions').create((record) => {
            record.interactionDate = event.startDate;
            record.interactionType = event.suggestedCategory || 'hangout';
            record.interactionCategory = event.suggestedCategory || 'hangout';
            record.status = 'completed';
            record.title = event.title;
            record.location = event.location;
            record.mode = 'ambient'; // Special mode for calendar-sourced events

            // Add emotional context if provided
            if (reflectionNotes) {
              record.note = reflectionNotes;
            }

            // Could add vibe based on emotional rating
            if (emotionalRating) {
              if (emotionalRating >= 4) record.vibe = 'full-moon';
              else if (emotionalRating === 3) record.vibe = 'waxing-gibbous';
              else if (emotionalRating === 2) record.vibe = 'waning-gibbous';
              else record.vibe = 'new-moon';
            }
          });

          // Link friends
          const interactionFriendsCollection = database.get('interaction_friends');
          for (const match of event.matchedFriends) {
            await interactionFriendsCollection.create((record: any) => {
              record.interaction.set(interaction);
              record.friend.set(match.friend);
            });
          }

          result.interactionIds.push(interaction.id);
          result.loggedCount++;

          Logger.info(`[WeeklyReview] Logged event "${event.title}" as interaction ${interaction.id}`);
        });

        // Record feedback as accepted
        await recordFeedback({
          event,
          action: 'accepted',
          emotionalRating,
          reflectionNotes,
          resultingInteractionId: result.interactionIds[result.interactionIds.length - 1],
        });

      } catch (error) {
        Logger.error(`[WeeklyReview] Error logging event "${event.title}":`, error);
        result.errors++;
        result.success = false;
      }
    }

    Logger.info(`[WeeklyReview] Batch log complete: ${result.loggedCount} logged, ${result.errors} errors`);
    return result;

  } catch (error) {
    Logger.error('[WeeklyReview] Error in batch log:', error);
    return {
      success: false,
      loggedCount: 0,
      errors: events.length,
      interactionIds: [],
    };
  }
}

/**
 * Dismiss a calendar event (won't show again)
 */
export async function dismissCalendarEvent(params: {
  event: ScannedEvent;
  reason: 'wrong-friends' | 'not-social' | 'already-logged' | 'not-relevant';
}): Promise<void> {
  const { event, reason } = params;

  try {
    await recordFeedback({
      event,
      action: 'dismissed',
      dismissalReason: reason,
    });

    Logger.info(`[WeeklyReview] Dismissed event "${event.title}" (reason: ${reason})`);
  } catch (error) {
    Logger.error('[WeeklyReview] Error dismissing event:', error);
  }
}

/**
 * Snooze suggestions for a specific friend or event pattern
 */
export async function snoozeFromWeeklyReview(params: {
  type: 'friend' | 'event-pattern';
  friendId?: string;
  eventPattern?: string;
  days: 7 | 14 | 30;
}): Promise<void> {
  const { type, friendId, eventPattern, days } = params;

  try {
    const until = Date.now() + (days * 24 * 60 * 60 * 1000);

    // Create a dummy event for recording snooze
    // (We need an event reference for recordFeedback)
    const snoozeEvent: Partial<ScannedEvent> = {
      id: `snooze-${type}-${Date.now()}`,
      title: eventPattern || 'Snoozed',
      startDate: new Date(),
      endDate: new Date(),
      allDay: false,
      eventType: 'social',
      importance: 'medium',
      confidence: 1,
      matchedFriends: [],
      extractedNames: [],
    };

    await recordFeedback({
      event: snoozeEvent as ScannedEvent,
      action: 'snoozed',
      snoozeConfig: {
        type,
        friendId,
        eventPattern,
        until,
      },
    });

    Logger.info(`[WeeklyReview] Snoozed ${type} for ${days} days`);
  } catch (error) {
    Logger.error('[WeeklyReview] Error creating snooze:', error);
  }
}
