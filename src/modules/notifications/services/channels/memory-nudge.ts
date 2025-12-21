
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
import { NOTIFICATION_CONFIG } from '../../notification.config';

const ID_PREFIX = 'memory-nudge-';

export const MemoryNudgeChannel: NotificationChannel = {
    schedule: async (): Promise<void> => {
        try {
            const config = NOTIFICATION_CONFIG['memory-nudge'];
            if (!config.enabled) {
                Logger.info('[MemoryNudge] Disabled in config');
                return;
            }

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
            if (config.limits.dailyBudgetCost > 0 && budget.used + config.limits.dailyBudgetCost > budget.limit) {
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

            // Schedule based on config
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (config.schedule.type === 'daily' && config.schedule.hour !== undefined) {
                tomorrow.setHours(config.schedule.hour, config.schedule.minute || 0, 0, 0);
            } else {
                // Fallback default
                tomorrow.setHours(9, 0, 0, 0);
            }

            const trigger = tomorrow.getTime();

            // Resolve template (simple internal interpolation replacement)
            // Note: The config template uses {{title}} and {{description}}
            // We replace them with actual values.
            let title = config.templates.default.title
                .replace('{{title}}', bestMemory.title);
            let body = config.templates.default.body
                .replace('{{description}}', bestMemory.description);

            // Fallback if template resulted in empty string (e.g. if config was just {{title}} and title was empty)
            if (!title) title = bestMemory.title;
            if (!body) body = bestMemory.description;

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: title,
                    body: body,
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
            if (config.limits.dailyBudgetCost > 0) {
                await notificationStore.checkAndIncrementBudget();
            }

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

