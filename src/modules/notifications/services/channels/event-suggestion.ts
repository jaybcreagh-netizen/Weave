
/**
 * Event Suggestion Channel
 * Suggestions to log calendar events that were scanned
 * 
 * NOTE: Events are now stored for the evening digest instead of 
 * pushing immediate notifications. This creates a calmer experience.
 */

import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { shouldSendAmbientLoggingNotification } from '../notification-grace-periods';
import { notificationStore } from '../notification-store';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '@/modules/notifications';
import { ScannedEvent } from '@/modules/interactions';

export async function scheduleEventSuggestionNotification(event: ScannedEvent) {
    return EventSuggestionChannel.scheduleEvent(event);
}

const MAX_ID_LENGTH = 64; // Expo imposes limits on ID length on Android sometimes, but usually string is fine.
const ID_PREFIX = 'event-suggestion-';

// Emoji helper
function getEventEmoji(eventType: string): string {
    const emojiMap: Record<string, string> = {
        birthday: '🎂',
        anniversary: '💝',
        holiday: '🎉',
        meal: '🍽️',
        social: '🎊',
        activity: '🎯',
        celebration: '🎉',
        meeting: '👥',
        call: '📞',
        default: '📅',
    };
    return emojiMap[eventType] || emojiMap.default;
}

export const EventSuggestionChannel: NotificationChannel & {
    scheduleEvent: (event: ScannedEvent) => Promise<string | null>
} = {
    // Generic schedule not used here, typically called with specific event
    schedule: async () => { },

    /**
     * Instead of pushing a notification immediately, store the event
     * for the evening digest. This prevents jarring immediate notifications.
     */
    scheduleEvent: async (event: ScannedEvent): Promise<string | null> => {
        try {
            const grace = await shouldSendAmbientLoggingNotification();
            if (!grace.shouldSend) {
                Logger.info('[EventSuggestion] Grace period blocking:', grace.reason);
                return null;
            }

            const friendNames = event.matchedFriends.map(m => m.friend.name).join(', ');

            // Store for digest instead of scheduling immediate notification
            await notificationStore.addPendingEvent({
                eventId: event.id,
                title: event.title,
                friendNames,
                eventDate: event.startDate.toISOString(),
                friendIds: event.matchedFriends.map(m => m.friend.id),
                suggestedCategory: event.suggestedCategory,
            });

            Logger.info(`[EventSuggestion] Stored for digest: ${event.title}`);
            return event.id;

        } catch (error) {
            Logger.error('[EventSuggestion] Error storing for digest:', error);
            return null;
        }
    },

    cancel: async (id?: string): Promise<void> => {
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
        }
    },

    handleTap: (data, router) => {
        if (data?.type !== 'event-suggestion') return;

        const {
            friendIds,
            eventDate,
            eventTitle,
            suggestedCategory,
            location,
            notes,
        } = data;

        // WeaveLogger currently mainly supports friendId param.
        // For now, we route there with the first friend to prevent the dead-end.

        const params: any = {};
        if (Array.isArray(friendIds) && friendIds.length > 0) {
            params.friendId = friendIds[0];
        } else if (typeof friendIds === 'string') {
            params.friendId = friendIds;
        }

        // Pass date if available
        if (eventDate) {
            params.date = eventDate;
        }

        // Pass category if available
        if (suggestedCategory) {
            params.category = suggestedCategory;
        }

        // Combine notes and location
        let combinedNotes = notes || '';
        if (location) {
            combinedNotes = combinedNotes
                ? `Location: ${location}\n\n${combinedNotes}`
                : `Location: ${location}`;
        }
        if (combinedNotes) {
            params.notes = combinedNotes;
        }

        // Pass title
        if (eventTitle) {
            params.title = eventTitle;
        }

        router.push({
            pathname: '/weave-logger',
            params
        });

        notificationAnalytics.trackActionCompleted('event-suggestion', 'open_form');
    }
};
