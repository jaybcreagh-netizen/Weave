import { database } from '@/db';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import { Suggestion } from '@/shared/types/common';
import type { SuggestionDismissalReason } from '@/shared/types/common';
import { Q } from '@nozbe/watermelondb';
import { OpportunityPoolService } from './opportunity-system/OpportunityPoolService';
import type {
  OpportunityPresentationCopy,
  SelectorPacingSnapshot,
  SelectorSurfaceRequestKind,
} from './opportunity-system/types';
import { SelectorExperimentService } from './opportunity-system/SelectorExperimentService';

/**
 * Service for tracking suggestion events to enable learning and optimization
 */

interface TrackingContext {
  friendScore: number;
  daysSinceLastInteraction: number;
}

interface SurfaceTrackingMetadata {
  compositeScore?: number;
  scoreBreakdown?: Record<string, number>;
  surfaceSource?: 'legacy-list' | 'selector';
  selectionReason?: 'selected' | 'below_threshold' | 'empty';
  surfaceSlot?: 'primary' | 'secondary';
  opportunitySource?: 'synthesized' | 'pool';
  surfaceRequestKind?: SelectorSurfaceRequestKind;
}

interface QuietTrackingMetadata {
  quietReason: string;
  selectionReason?: 'selected' | 'below_threshold' | 'empty';
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  pacingSnapshot?: SelectorPacingSnapshot;
}

function buildPresentationCopyFromSuggestion(
  suggestion: Suggestion
): OpportunityPresentationCopy {
  return {
    title: suggestion.title,
    subtitle: suggestion.subtitle,
    contextSnippet: suggestion.contextSnippet,
    actionLabel: suggestion.actionLabel,
    reason: suggestion.reason,
    aiEnriched: suggestion.aiEnriched,
  };
}

/**
 * Records when a suggestion is shown to the user
 */
export async function trackSuggestionShown(
  suggestion: Suggestion,
  context: TrackingContext,
  metadata: SurfaceTrackingMetadata = {}
): Promise<void> {
  const selectorExperimentConfig = metadata.surfaceSource === 'selector'
    ? await SelectorExperimentService.getConfig()
    : null;

  await database.write(async () => {
    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestion.id;
      event.friendId = suggestion.friendId;
      event.suggestionType = suggestion.category || 'Connection'; // Modified line
      event.urgency = suggestion.urgency || 'medium';
      event.actionType = suggestion.action.type;
      event.eventType = 'shown';
      event.eventTimestamp = new Date();
      event.friendScoreAtEvent = context.friendScore;
      event.daysSinceLastInteraction = context.daysSinceLastInteraction;
    });
  });

  await OpportunityPoolService.recordOpportunityEventByIds([suggestion.id], 'surfaced', {
    compositeScore: metadata.compositeScore,
    scoreBreakdown: metadata.scoreBreakdown,
    surfaceSource: metadata.surfaceSource,
    selectionReason: metadata.selectionReason,
    surfaceSlot: metadata.surfaceSlot,
    opportunitySource: metadata.opportunitySource,
    surfaceRequestKind: metadata.surfaceRequestKind,
    thresholdVariant: selectorExperimentConfig?.thresholdVariant,
    copyVariant: selectorExperimentConfig?.copyVariant,
    presentationCopy: buildPresentationCopyFromSuggestion(suggestion),
  });
}

export async function trackSelectorQuietDisplayed(
  metadata: QuietTrackingMetadata
): Promise<void> {
  const selectorExperimentConfig = await SelectorExperimentService.getConfig();

  await OpportunityPoolService.recordSelectorSystemEvent('quiet', {
    surfaceSource: 'selector',
    selectionReason: metadata.selectionReason,
    quietReason: metadata.quietReason,
    surfaceRequestKind: metadata.surfaceRequestKind,
    pacingSnapshot: metadata.pacingSnapshot,
    thresholdVariant: selectorExperimentConfig?.thresholdVariant,
    copyVariant: selectorExperimentConfig?.copyVariant,
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

  await OpportunityPoolService.recordOpportunityEventByIds([suggestionId], 'acted');
}

/**
 * Records when a user dismisses a suggestion
 */
export async function trackSuggestionDismissed(
  suggestionId: string,
  reason?: SuggestionDismissalReason,
  cooldownDays?: number
): Promise<void> {
  await database.write(async () => {
    // Find the original "shown" event for context
    const shownEvents = await database
      .get<SuggestionEvent>('suggestion_events')
      .query(
        Q.where('suggestion_id', suggestionId),
        Q.where('event_type', 'shown'),
        Q.sortBy('event_timestamp', Q.desc),
        Q.take(1)
      )
      .fetch();

    const shownEvent = shownEvents[0];
    const snoozedUntilTimestamp = typeof cooldownDays === 'number' && cooldownDays > 0
      ? Date.now() + (cooldownDays * 86400000)
      : undefined;

    await database.get<SuggestionEvent>('suggestion_events').create(event => {
      event.suggestionId = suggestionId;
      event.friendId = shownEvent?.friendId || '';
      event.suggestionType = shownEvent?.suggestionType || '';
      event.urgency = shownEvent?.urgency || '';
      event.actionType = shownEvent?.actionType || '';
      event.eventType = 'dismissed';
      event.eventTimestamp = new Date();
      event.dismissalReason = reason;
      if (snoozedUntilTimestamp) {
        event.snoozedUntil = new Date(snoozedUntilTimestamp);
      }
    });
  });

  await OpportunityPoolService.recordOpportunityEventByIds([suggestionId], 'dismissed', {
    feedbackType: reason,
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

  await OpportunityPoolService.recordOpportunityEventByIds([suggestionId], 'expired');
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
export const SuggestionTrackerService = {
  trackSuggestionShown,
  trackSuggestionActed,
  trackSuggestionDismissed,
  trackSuggestionExpired,
  trackSelectorQuietDisplayed,
  getSuggestionAnalytics
};
