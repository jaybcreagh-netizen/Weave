/**
 * Holiday Season Generator
 *
 * Generates suggestions for connecting with friends during holidays
 * and seasonal moments. Works alongside LifeEventGenerator but focuses
 * on calendar-based occasions rather than personal events.
 */

import { Suggestion, Archetype } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import {
  getNextActionableHoliday,
  getUpcomingHolidays,
  UpcomingHoliday,
} from '@/modules/intelligence/services/calendar-season';
import {
  getArchetypeHolidaySuggestion,
  getHolidaySuggestionTitle,
  getHolidaySuggestionSubtitle,
} from '@/modules/intelligence/services/calendar-season/seasonal-prompts';
import { daysSince } from '@/shared/utils/date-utils';

/**
 * Priority levels for holiday suggestions:
 * - Holiday today: Priority 2.5 (after urgent life events, before intentions)
 * - Holiday tomorrow: Priority 4 (similar to upcoming plans)
 * - Holiday within lead time: Priority 8 (similar to deepen)
 */
export class HolidaySeasonGenerator implements SuggestionGenerator {
  name = 'HolidaySeasonGenerator';
  priority = 8; // Base priority, actual varies by urgency

  async generate(context: SuggestionContext): Promise<Suggestion | null> {
    const { friend, now, lastInteractionDate } = context;

    // Get upcoming holidays
    const upcomingHolidays = getUpcomingHolidays({
      now,
      maxDaysAhead: 14, // Look 2 weeks ahead
    });

    if (upcomingHolidays.length === 0) return null;

    // Find the most relevant holiday to suggest for this friend
    const holiday = this.selectBestHoliday(upcomingHolidays, friend, lastInteractionDate);

    if (!holiday) return null;

    return this.createSuggestion(holiday, friend, now);
  }

  /**
   * Select the best holiday to suggest for this friend
   * Considers: urgency, relationship type, recent contact
   */
  private selectBestHoliday(
    holidays: UpcomingHoliday[],
    friend: SuggestionContext['friend'],
    lastInteraction: Date | null
  ): UpcomingHoliday | null {
    // Skip if we've interacted very recently (within 2 days)
    if (lastInteraction && daysSince(lastInteraction) < 2) {
      return null;
    }

    // Prioritize holidays by relevance
    for (const holiday of holidays) {
      // Skip if not within lead time
      if (!holiday.isWithinLeadTime) continue;

      // Check if holiday category matches friend type
      const isRelevant = this.isHolidayRelevantForFriend(holiday, friend);
      if (!isRelevant) continue;

      return holiday;
    }

    return null;
  }

  /**
   * Check if a holiday is relevant for this friend
   */
  private isHolidayRelevantForFriend(
    holiday: UpcomingHoliday,
    friend: SuggestionContext['friend']
  ): boolean {
    const { category } = holiday.holiday;
    const relationshipType = friend.relationshipType?.toLowerCase() || '';

    // Mother's/Father's Day only for family
    if (holiday.holiday.id.includes('mothers-day') || holiday.holiday.id.includes('fathers-day')) {
      return relationshipType.includes('family') || relationshipType.includes('parent');
    }

    // Valentine's is relevant for partners and close friends
    if (holiday.holiday.id === 'valentines-day') {
      return relationshipType.includes('partner') ||
        friend.tier === 'InnerCircle' ||
        friend.tier === 'CloseFriends';
    }

    // Galentine's for friends (non-partner)
    if (holiday.holiday.id === 'galentines-day') {
      return !relationshipType.includes('partner');
    }

    // Major holidays are relevant for everyone in inner circle and close friends
    if (category === 'major') {
      return friend.tier === 'InnerCircle' || friend.tier === 'CloseFriends';
    }

    // Gratitude holidays (Thanksgiving, etc.) - inner circle
    if (category === 'gratitude') {
      return friend.tier === 'InnerCircle';
    }

    // Seasonal markers - all tiers but prioritize closer friends
    if (category === 'seasonal') {
      return friend.tier === 'InnerCircle' || friend.tier === 'CloseFriends';
    }

    // Friendship Day - perfect for all friends
    if (holiday.holiday.id === 'friendship-day') {
      return true;
    }

    // Cultural holidays - only if enabled (default false for most)
    if (category === 'cultural') {
      return friend.tier === 'InnerCircle';
    }

    return true;
  }

  /**
   * Create the suggestion object
   */
  private createSuggestion(
    holiday: UpcomingHoliday,
    friend: SuggestionContext['friend'],
    now: Date
  ): Suggestion {
    const title = getHolidaySuggestionTitle(friend.name, holiday);
    const subtitle = friend.archetype
      ? getArchetypeHolidaySuggestion(friend.archetype as Archetype, holiday.holiday.name)
      : getHolidaySuggestionSubtitle(holiday);

    // Determine urgency based on timing
    let urgency: Suggestion['urgency'];
    if (holiday.isToday) {
      urgency = 'high';
    } else if (holiday.isTomorrow) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }

    // Determine action type - today means reach out now, otherwise plan
    const actionType = holiday.isToday ? 'log' : 'plan';

    return {
      id: `holiday-${holiday.holiday.id}-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      type: 'connect',
      urgency,
      category: 'seasonal',
      title,
      subtitle,
      actionLabel: holiday.isToday ? 'Reach Out' : 'Plan',
      icon: holiday.holiday.icon,
      action: {
        type: actionType,
        prefilledCategory: this.getPrefilledCategory(holiday),
      },
      dismissible: true,
      createdAt: now,
      // Expire after the holiday passes
      expiresAt: new Date(holiday.date.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Get prefilled category based on holiday type
   */
  private getPrefilledCategory(holiday: UpcomingHoliday): string {
    const { category, id } = holiday.holiday;

    // Special cases
    if (id === 'valentines-day' || id === 'galentines-day') {
      return 'meal-drink';
    }

    if (category === 'major') {
      return 'celebration';
    }

    if (category === 'gratitude') {
      return 'deep-talk';
    }

    return 'text-call';
  }
}
