
/**
 * Memory Nudge Channel
 * Handles anniversary reflections
 */

import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '../../types';
import { getAnniversaryMemories, getMemoryForNotification } from '@/modules/journal/services/journal-context-engine';

const ID_PREFIX = 'memory-nudge-';

export const MemoryNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            // Get memories for roughly "today" (logic inside handles window)
            const memories = await getAnniversaryMemories();

            // Clear old
            await MemoryNudgeChannel.cancel(ID_PREFIX);

            if (memories.length === 0) return;

            // Sort by priority and take the top one
            const bestMemory = memories.sort((a: any, b: any) => b.priority - a.priority)[0];

            if (!bestMemory) return;

            const id = `${ID_PREFIX}${bestMemory.relatedEntryId}`;

            // Schedule for 9:00 AM tomorrow if it's late, or maybe just schedule for a reasonable time?
            // "Nudges" should be gentle. Let's schedule for 9 AM tomorrow to ensure it's seen fresh.
            // Or if debugging, maybe sooner. Let's stick to the standard "morning update".
            // Schedule for 9:00 AM tomorrow if it's late, or maybe just schedule for a reasonable time?
            // "Nudges" should be gentle. Let's schedule for 9 AM tomorrow to ensure it's seen fresh.
            // Or if debugging, maybe sooner. Let's stick to the standard "morning update".
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);

            const trigger = tomorrow.getTime();

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: bestMemory.title,
                    body: bestMemory.description,
                    data: {
                        type: 'memory-nudge',
                        entryId: bestMemory.relatedEntryId,
                        entryType: bestMemory.type === 'first_entry' ? 'first_entry' :
                            (bestMemory.id.includes('reflection') ? 'reflection' : 'journal')
                    },
                },
                trigger: trigger as any,
            });

            await notificationAnalytics.trackScheduled('memory-nudge', id, {
                entryId: bestMemory.relatedEntryId,
                type: bestMemory.type
            });

        } catch (error) {
            Logger.error('[MemoryNudge] Error:', error);
        }
    },

    cancel: async (matchPrefix: string = ID_PREFIX): Promise<void> => {
        const all = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of all) {
            if (n.identifier.startsWith(matchPrefix)) {
                await Notifications.cancelScheduledNotificationAsync(n.identifier);
            }
        }
    },

    handleTap: async (data: any, router: any) => {
        try {
            const { entryId, entryType } = data;

            // Lazy load store to avoid potential cycles if imported at top level
            const { useUIStore } = require('@/stores/uiStore');

            if (entryType === 'reflection' || entryType === 'journal') {
                const memoryData = await getMemoryForNotification(entryId, entryType);
                if (memoryData) {
                    useUIStore.getState().openMemoryMoment(memoryData);
                    return;
                }
            }

            // Fallback if data fetch fails or unknown type
            router.replace('/dashboard');
        } catch (error) {
            Logger.error('[MemoryNudge] Error handling tap:', error);
            router.replace('/dashboard');
        }
    }
};

