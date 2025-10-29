import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * SuggestionEvent tracks user interactions with suggestions for learning and optimization.
 *
 * Event Types:
 * - "shown": Suggestion was displayed to user
 * - "acted": User acted on the suggestion (opened form, created plan, etc.)
 * - "dismissed": User dismissed/snoozed the suggestion
 * - "expired": Suggestion expired without action (e.g., 24hr reflection window passed)
 */
export default class SuggestionEvent extends Model {
  static table = 'suggestion_events';

  @field('suggestion_id') suggestionId!: string;
  @field('friend_id') friendId!: string;
  @field('suggestion_type') suggestionType!: string; // reflect, drift, deepen, maintain, insight, celebrate
  @field('urgency') urgency!: string; // critical, high, medium, low
  @field('action_type') actionType!: string; // log, plan, reflect
  @field('event_type') eventType!: 'shown' | 'acted' | 'dismissed' | 'expired';
  @date('event_timestamp') eventTimestamp!: Date;

  // Context at time of event
  @field('friend_score_at_event') friendScoreAtEvent?: number;
  @field('days_since_last_interaction') daysSinceLastInteraction?: number;

  // Outcome tracking
  @field('resulting_interaction_id') resultingInteractionId?: string;
  @field('time_to_action_minutes') timeToActionMinutes?: number; // How long from "shown" to "acted"

  @readonly @date('created_at') createdAt!: Date;
}
