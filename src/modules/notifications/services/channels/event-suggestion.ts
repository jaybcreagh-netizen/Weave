
/**
 * Event Suggestion Channel
 * Suggestions to log calendar events that were scanned
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { shouldSendAmbientLoggingNotification } from '../notification-grace-periods';
import { NotificationChannel } from '../../types';
import { ScannedEvent } from '@/modules/interactions/services/event-scanner';
import { format } from 'date-fns';

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

    scheduleEvent: async (event: ScannedEvent): Promise<string | null> => {
        try {
            const grace = await shouldSendAmbientLoggingNotification();
            if (!grace.shouldSend) {
                Logger.info('[EventSuggestion] Grace period blocking:', grace.reason);
                return null;
            }

            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') return null;

            const friendNames = event.matchedFriends.map(m => m.friend.name).join(', ');
            const dateStr = format(event.startDate, 'EEEE, MMM d');
            const emoji = getEventEmoji(event.eventType);

            const title = `${emoji} Did you weave?`;
            const body = `You had "${event.title}" with ${friendNames} on ${dateStr}. Tap to log it.`;

            const id = `${ID_PREFIX}${event.id}`;

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title,
                    body,
                    data: {
                        type: 'event-suggestion',
                        eventId: event.id,
                        friendIds: event.matchedFriends.map(m => m.friend.id),
                        eventTitle: event.title,
                        eventDate: event.startDate.toISOString(),
                        suggestedCategory: event.suggestedCategory,
                        location: event.location,
                        notes: event.notes,
                    },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.DEFAULT,
                    ...(Platform.OS === 'android' ? { channelId: 'event-suggestions' } : {}),
                },
                // Schedule for 10 seconds later? Legacy code did this.
                trigger: {
                    seconds: 10,
                    repeats: false,
                } as any,
            });

            await notificationAnalytics.trackScheduled('event-suggestion', id, {
                eventId: event.id,
                eventType: event.eventType
            });

            Logger.info(`[EventSuggestion] Scheduled for ${event.title}`);
            return id;

        } catch (error) {
            Logger.error('[EventSuggestion] Error scheduling:', error);
            return null;
        }
    },

    cancel: async (id: string): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(id);
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

        const params = new URLSearchParams({
            type: 'log',
            friendIds: Array.isArray(friendIds) ? friendIds.join(',') : friendIds,
            date: eventDate,
            title: eventTitle,
        });

        if (suggestedCategory) params.append('category', suggestedCategory);
        if (location) params.append('location', location);
        if (notes) params.append('notes', notes);

        router.push(`/interaction-form?${params.toString()}`);
        notificationAnalytics.trackActionCompleted('event-suggestion', 'open_form');
    }
};
