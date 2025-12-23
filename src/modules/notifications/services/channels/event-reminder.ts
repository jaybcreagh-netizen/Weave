
/**
 * Event Reminder Channel
 * Handles scheduling of reminders for upcoming interactions
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '@/modules/notifications';

const ID_PREFIX = 'event-reminder-';

export const EventReminderChannel: NotificationChannel & { scheduleAll: () => Promise<void> } = {
    schedule: async (interaction: Interaction): Promise<void> => {
        try {
            if (!interaction || interaction.status !== 'planned') return;

            const interactionDate = new Date(interaction.interactionDate);
            const now = new Date();

            if (interactionDate <= now) return;

            // 1 hour before
            const reminderTime = new Date(interactionDate.getTime() - 60 * 60 * 1000);
            if (reminderTime <= now) return;

            // Fetch friend names
            const joinRecords = await database
                .get('interaction_friends')
                .query(Q.where('interaction_id', interaction.id))
                .fetch();

            const friendIds = joinRecords.map((jr: any) => jr.friendId);
            const friends = await database
                .get<Friend>('friends')
                .query(Q.where('id', Q.oneOf(friendIds)))
                .fetch();

            const friendNames = friends.map(f => f.name).join(', ');

            const id = `${ID_PREFIX}${interaction.id}`;

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: `Upcoming: ${interaction.interactionCategory || interaction.activity || 'Connection'} 🗓️`,
                    body: `With ${friendNames} in 1 hour`,
                    data: {
                        type: 'event-reminder',
                        interactionId: interaction.id,
                        friendId: friends.length > 0 ? friends[0].id : undefined,
                    },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: reminderTime
                },
            });

            await notificationAnalytics.trackScheduled('event-reminder', id, {
                interactionId: interaction.id,
                category: interaction.interactionCategory,
            });
        } catch (error) {
            Logger.error('[EventReminder] Error scheduling:', error);
        }
    },

    scheduleAll: async (): Promise<void> => {
        try {
            const now = Date.now();
            const plannedInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('status', 'planned'),
                    Q.where('interaction_date', Q.gt(now))
                )
                .fetch();

            Logger.info(`[EventReminder] Scheduling ${plannedInteractions.length} reminders`);

            for (const interaction of plannedInteractions) {
                await EventReminderChannel.schedule(interaction);
            }
        } catch (error) {
            Logger.error('[EventReminder] Error scheduling all:', error);
        }
    },

    cancel: async (interactionId?: string): Promise<void> => {
        if (!interactionId) return;
        const id = `${ID_PREFIX}${interactionId}`;
        await Notifications.cancelScheduledNotificationAsync(id);
        notificationAnalytics.trackCancelled('event-reminder', 'interaction_changed');
    },

    handleTap: (data, router) => {
        if (data.friendId) {
            router.push(`/friend-profile?friendId=${data.friendId}`);
            notificationAnalytics.trackActionCompleted('event-reminder', 'view_profile');
        } else {
            router.replace('/dashboard');
        }
    }
};
