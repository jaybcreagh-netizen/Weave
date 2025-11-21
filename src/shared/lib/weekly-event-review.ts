/**
 * Weekly Event Review System
 *
 * Scans past week's calendar events and presents them during weekly reflection
 * for mindful, batched logging. Integrates with learning system to filter noise.
 */

import { database } from '@/db';
import InteractionModel from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import { scanCalendarEvents, type ScannedEvent } from '@/modules/interactions';
import { shouldFilterEvent, isAmbiguousEvent, recordFeedback } from '@/modules/interactions';
import { CalendarService } from '@/modules/interactions';

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
      console.log('[WeeklyReview] Calendar sync disabled');
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

    console.log('[WeeklyReview] Scanning events from', weekAgo, 'to', now);

    // Scan calendar
    const scanResult = await scanCalendarEvents({
      startDate: weekAgo,
      endDate: now,
      includeWeaveEvents: false,
      minImportance: 'medium',
    });

    console.log(`[WeeklyReview] Found ${scanResult.totalScanned} events, ${scanResult.matchedEvents} with friend matches`);

    // Filter to only events with friend matches
    const candidateEvents = scanResult.events.filter(e => e.matchedFriends.length > 0);

    // Check if already logged
    const unloggedEvents: ScannedEvent[] = [];
    for (const event of candidateEvents) {
      const isLogged = await isEventAlreadyLogged(event);
      if (!isLogged) {
        unloggedEvents.push(event);
      }
    }

    console.log(`[WeeklyReview] ${unloggedEvents.length} unlogged events`);

    // Apply learning filters
    const filteredEvents: ScannedEvent[] = [];
    let filteredCount = 0;
    let ambiguousCount = 0;

    for (const event of unloggedEvents) {
      // Check learning filters
      const filterResult = await shouldFilterEvent(event);
      if (filterResult.shouldFilter) {
        console.log(`[WeeklyReview] Filtered event "${event.title}": ${filterResult.reason}`);
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

    console.log(`[WeeklyReview] Final: ${filteredEvents.length} events, ${filteredCount} filtered, ${ambiguousCount} ambiguous`);

    return {
      events: filteredEvents,
      totalScanned: scanResult.totalScanned,
      filteredCount,
      ambiguousCount,
    };
  } catch (error) {
    console.error('[WeeklyReview] Error scanning week:', error);
    return {
      events: [],
      totalScanned: 0,
      filteredCount: 0,
      ambiguousCount: 0,
    };
  }
}

/**
 * Check if a calendar event has already been logged as an interaction
 */
async function isEventAlreadyLogged(event: ScannedEvent): Promise<boolean> {
  try {
    // Check if any interaction exists for this event's friends around the same time
    // Look for interactions within +/- 3 hours of event time
    const eventTime = event.startDate.getTime();
    const threeHours = 3 * 60 * 60 * 1000;
    const startWindow = eventTime - threeHours;
    const endWindow = eventTime + threeHours;

    const friendIds = event.matchedFriends.map(m => m.friend.id);

    // Query interactions in time window
    const interactions = await database
      .get<InteractionModel>('interactions')
      .query(
        Q.where('interaction_date', Q.gte(startWindow)),
        Q.where('interaction_date', Q.lte(endWindow)),
        Q.where('status', 'completed')
      )
      .fetch();

    // Check if any interaction involves these friends
    for (const interaction of interactions) {
      const interactionFriendIds = await interaction.friends.fetch();
      const friendIdSet = new Set(interactionFriendIds.map(f => f.id));

      // If any of the event's friends are in this interaction, consider it logged
      const hasOverlap = friendIds.some(id => friendIdSet.has(id));
      if (hasOverlap) {
        console.log(`[WeeklyReview] Event "${event.title}" already logged as interaction ${interaction.id}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[WeeklyReview] Error checking if event logged:', error);
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
            record.category = event.suggestedCategory || 'hangout';
            record.status = 'completed';
            record.title = event.title;
            record.location = event.location;
            record.mode = 'ambient'; // Special mode for calendar-sourced events

            // Add emotional context if provided
            if (reflectionNotes) {
              record.notes = reflectionNotes;
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

          console.log(`[WeeklyReview] Logged event "${event.title}" as interaction ${interaction.id}`);
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
        console.error(`[WeeklyReview] Error logging event "${event.title}":`, error);
        result.errors++;
        result.success = false;
      }
    }

    console.log(`[WeeklyReview] Batch log complete: ${result.loggedCount} logged, ${result.errors} errors`);
    return result;

  } catch (error) {
    console.error('[WeeklyReview] Error in batch log:', error);
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

    console.log(`[WeeklyReview] Dismissed event "${event.title}" (reason: ${reason})`);
  } catch (error) {
    console.error('[WeeklyReview] Error dismissing event:', error);
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

    console.log(`[WeeklyReview] Snoozed ${type} for ${days} days`);
  } catch (error) {
    console.error('[WeeklyReview] Error creating snooze:', error);
  }
}
