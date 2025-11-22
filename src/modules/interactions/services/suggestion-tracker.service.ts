import { database } from '@/db';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import { Suggestion } from '@/types/suggestions';
import { Q } from '@nozbe/watermelondb';

/**
 * Service for tracking suggestion events to enable learning and optimization
 */

interface TrackingContext {
  friendScore: number;
  daysSinceLastInteraction: number;
}

/**
 * Records when a suggestion is shown to the user
 */
export async function trackSuggestionShown(
  suggestion: Suggestion,
  context: TrackingContext
): Promise<void> {
  await database.write(async () => {
    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestion.id;
      event.friendId = suggestion.friendId;
      event.suggestionType = suggestion.category;
      event.urgency = suggestion.urgency;
      event.actionType = suggestion.action.type;
      event.eventType = 'shown';
      event.eventTimestamp = new Date();
      event.friendScoreAtEvent = context.friendScore;
      event.daysSinceLastInteraction = context.daysSinceLastInteraction;
    });
  });
}

/**
 * Records when a user acts on a suggestion
 */
export async function trackSuggestionActed(
  suggestionId: string,
  resultingInteractionId?: string
): Promise<void> {
  await database.write(async () => {
    // Find the "shown" event to calculate time to action
    const shownEvents = await database
      .get<SuggestionEvent>('suggestion_events')
      .query(
        Q.where('suggestion_id', suggestionId),
        Q.where('event_type', 'shown')
      )
      .fetch();

    const shownEvent = shownEvents[0];
    const timeToActionMinutes = shownEvent
      ? Math.round((Date.now() - shownEvent.eventTimestamp.getTime()) / 60000)
      : undefined;

    // Create the "acted" event
    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestionId;
      event.friendId = shownEvent?.friendId || '';
      event.suggestionType = shownEvent?.suggestionType || '';
      event.urgency = shownEvent?.urgency || '';
      event.actionType = shownEvent?.actionType || '';
      event.eventType = 'acted';
      event.eventTimestamp = new Date();
      event.resultingInteractionId = resultingInteractionId;
      event.timeToActionMinutes = timeToActionMinutes;
    });
  });
}

/**
 * Records when a user dismisses a suggestion
 */
export async function trackSuggestionDismissed(suggestionId: string): Promise<void> {
  await database.write(async () => {
    // Find the original "shown" event for context
    const shownEvents = await database
      .get<SuggestionEvent>('suggestion_events')
      .query(
        Q.where('suggestion_id', suggestionId),
        Q.where('event_type', 'shown')
      )
      .fetch();

    const shownEvent = shownEvents[0];

    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestionId;
      event.friendId = shownEvent?.friendId || '';
      event.suggestionType = shownEvent?.suggestionType || '';
      event.urgency = shownEvent?.urgency || '';
      event.actionType = shownEvent?.actionType || '';
      event.eventType = 'dismissed';
      event.eventTimestamp = new Date();
    });
  });
}

/**
 * Records when a suggestion expires without action
 */
export async function trackSuggestionExpired(suggestionId: string): Promise<void> {
  await database.write(async () => {
    const shownEvents = await database
      .get<SuggestionEvent>('suggestion_events')
      .query(
        Q.where('suggestion_id', suggestionId),
        Q.where('event_type', 'shown')
      )
      .fetch();

    const shownEvent = shownEvents[0];

    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestionId;
      event.friendId = shownEvent?.friendId || '';
      event.suggestionType = shownEvent?.suggestionType || '';
      event.urgency = shownEvent?.urgency || '';
      event.actionType = shownEvent?.actionType || '';
      event.eventType = 'expired';
      event.eventTimestamp = new Date();
    });
  });
}

/**
 * Gets analytics on suggestion effectiveness
 * Useful for future optimization of the engine
 */
export async function getSuggestionAnalytics() {
  const events = await database.get<SuggestionEvent>('suggestion_events').query().fetch();

  const shown = events.filter(e => e.eventType === 'shown');
  const acted = events.filter(e => e.eventType === 'acted');
  const dismissed = events.filter(e => e.eventType === 'dismissed');

  // Calculate conversion rate (acted / shown)
  const conversionRate = shown.length > 0 ? (acted.length / shown.length) * 100 : 0;

  // Calculate average time to action
  const actedWithTime = acted.filter(e => e.timeToActionMinutes !== null);
  const avgTimeToAction =
    actedWithTime.length > 0
      ? actedWithTime.reduce((sum, e) => sum + (e.timeToActionMinutes || 0), 0) / actedWithTime.length
      : 0;

  // Breakdown by suggestion type
  const byType: Record<string, { shown: number; acted: number; conversionRate: number }> = {};
  const types = [...new Set(events.map(e => e.suggestionType))];

  types.forEach(type => {
    const typeShown = shown.filter(e => e.suggestionType === type).length;
    const typeActed = acted.filter(e => e.suggestionType === type).length;
    byType[type] = {
      shown: typeShown,
      acted: typeActed,
      conversionRate: typeShown > 0 ? (typeActed / typeShown) * 100 : 0,
    };
  });

  return {
    totalShown: shown.length,
    totalActed: acted.length,
    totalDismissed: dismissed.length,
    conversionRate: Math.round(conversionRate),
    avgTimeToActionMinutes: Math.round(avgTimeToAction),
    byType,
  };
}
