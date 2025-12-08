
/**
 * Deepening Nudge Channel
 * Handles post-interaction reflection nudges
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { notificationStore } from '../notification-store';
import { NotificationChannel } from '../../types';

const ID_PREFIX = 'deepening-nudge-';

export const DeepeningNudgeChannel: NotificationChannel = {
    schedule: async (interaction: Interaction): Promise<void> => {
        try {
            if (interaction.status !== 'completed') return;

            const interactionDate = new Date(interaction.interactionDate);
            const now = new Date();
            const hoursSince = (now.getTime() - interactionDate.getTime()) / (60 * 60 * 1000);

            // Don't modify if > 24h passed
            if (hoursSince > 24) return;

            // Limit to 2 per day
            const existingNudges = await notificationStore.getDeepeningNudges();
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const todayNudges = existingNudges.filter((n: any) => n.scheduledAt >= startOfDay.getTime());

            if (todayNudges.length >= 2) return;

            // Random delay 3-6 hours
            const delayHours = 3 + Math.random() * 3;
            const delayMs = delayHours * 60 * 60 * 1000;
            const nudgeTime = new Date(now.getTime() + delayMs);

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

            const primaryFriend = friends.length > 0 ? friends[0].name : 'your friend';

            const messages = [
                `How was your time with ${primaryFriend}? ✨`,
                `Your weave with ${primaryFriend}—how did it feel? 🌙`,
                `Reflecting on ${primaryFriend}: any insights? 💭`,
                `That connection with ${primaryFriend}—what stood out? 🕸️`,
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];

            const id = `${ID_PREFIX}${interaction.id}-${Date.now()}`;

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: randomMessage,
                    body: "Tap to add a reflection and deepen this weave.",
                    data: {
                        type: 'deepening-nudge',
                        interactionId: interaction.id,
                    },
                },
                trigger: nudgeTime as any,
            });

            await notificationAnalytics.trackScheduled('deepening-nudge', id, {
                interactionId: interaction.id,
                delayHours
            });

            // Save to store
            existingNudges.push({
                interactionId: interaction.id,
                scheduledAt: nudgeTime.getTime(),
                notificationId: id,
            });
            await notificationStore.setDeepeningNudges(existingNudges);

        } catch (error) {
            Logger.error('[DeepeningNudge] Error scheduling:', error);
        }
    },

    cancel: async (id: string): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(id);
    },

    handleTap: (data, router) => {
        if (data.interactionId) {
            router.push({
                pathname: '/journal',
                params: {
                    mode: 'guided',
                    weaveId: data.interactionId
                }
            });
            notificationAnalytics.trackActionCompleted('deepening-nudge', 'add_reflection');
        } else {
            router.replace('/dashboard');
        }
    }
};
