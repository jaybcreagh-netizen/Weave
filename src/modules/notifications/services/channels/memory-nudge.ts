
/**
 * Memory Nudge Channel
 * Handles anniversary reflections
 */

import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { notificationStore } from '../notification-store';
import { NotificationChannel } from '@/modules/notifications';
import { getAnniversaryMemories, getMemoryForNotification } from '@/modules/journal';
import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import { shouldSendNotification } from '../season-notifications.service';

const ID_PREFIX = 'memory-nudge-';

export const MemoryNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            // Get memories for roughly "today" (logic inside handles window)
            const memories = await getAnniversaryMemories();

            // Check if this type is suppressed (ignored 3+ times)
            if (await notificationStore.isTypeSuppressed('memory-nudge')) {
                Logger.info('[MemoryNudge] Suppressed due to repeated ignores');
                await MemoryNudgeChannel.cancel(ID_PREFIX);
                return;
            }

            // Check global daily budget
            const budget = await notificationStore.getDailyBudget();
            if (budget.used >= budget.limit) {
                Logger.info('[MemoryNudge] Daily budget exhausted');
                await MemoryNudgeChannel.cancel(ID_PREFIX);
                return;
            }

            // Check season suppression
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            const currentSeason = profiles[0]?.currentSocialSeason;

            if (!shouldSendNotification(currentSeason, 'memory-nudge')) {
                Logger.info('[MemoryNudge] Suppressed due to social season');
                // Even if suppressed, ensure we don't have lingering old ones
                await MemoryNudgeChannel.cancel(ID_PREFIX);
                return;
            }

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
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: trigger
                },
            });

            await notificationAnalytics.trackScheduled('memory-nudge', id, {
                entryId: bestMemory.relatedEntryId,
                type: bestMemory.type
            });

            // Increment global daily budget
            await notificationStore.checkAndIncrementBudget();

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

            // Use UIEventBus to trigger UI action from non-React context
            const { UIEventBus } = await import('@/shared/services/ui-event-bus');

            if (entryType === 'reflection' || entryType === 'journal') {
                const memoryData = await getMemoryForNotification(entryId, entryType);
                if (memoryData) {
                    UIEventBus.emit({ type: 'OPEN_MEMORY_MOMENT', data: memoryData });
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

