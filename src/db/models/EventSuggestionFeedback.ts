import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

export type FeedbackAction = 'accepted' | 'dismissed' | 'corrected' | 'snoozed';
export type DismissalReason = 'wrong-friends' | 'not-social' | 'already-logged' | 'not-relevant';
export type SnoozeType = 'friend' | 'event-pattern' | 'all';

/**
 * EventSuggestionFeedback tracks user responses to calendar event suggestions
 * Used for learning patterns and improving future suggestions
 */
export default class EventSuggestionFeedback extends Model {
  static table = 'event_suggestion_feedback';

  // Event identification
  @field('calendar_event_id') calendarEventId!: string;
  @field('event_title') eventTitle!: string;
  @date('event_date') eventDate!: Date;
  @field('event_location') eventLocation?: string;

  // Suggested friends
  @json('suggested_friend_ids', (json) => json) suggestedFriendIds!: string[];
  @field('suggested_category') suggestedCategory?: string;

  // User action
  @field('action') action!: FeedbackAction;
  @field('dismissal_reason') dismissalReason?: DismissalReason;

  // Corrections
  @json('corrected_friend_ids', (json) => json) correctedFriendIds?: string[];
  @field('corrected_category') correctedCategory?: string;

  // Snooze info
  @date('snoozed_until') snoozedUntil?: Date;
  @field('snooze_type') snoozeType?: SnoozeType;
  @json('snoozed_friend_ids', (json) => json) snoozedFriendIds?: string[];

  // Emotional context
  @field('emotional_rating') emotionalRating?: number;
  @field('reflection_notes') reflectionNotes?: string;

  // Linked interaction
  @field('resulting_interaction_id') resultingInteractionId?: string;

  // Learning metadata
  @field('confidence_score') confidenceScore!: number;
  @field('match_quality') matchQuality!: number;

  // Timestamps
  @date('suggested_at') suggestedAt!: Date;
  @date('responded_at') respondedAt?: Date;
  @readonly @date('created_at') createdAt!: Date;
}
