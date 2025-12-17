import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '@/modules/notifications';
import { FocusGenerator, FocusData } from '@/modules/intelligence';
import { notificationStore } from '../notification-store';
import { differenceInDays, startOfDay } from 'date-fns';
import { database } from '@/db';
import EveningDigest from '@/db/models/EveningDigest';
import { Q } from '@nozbe/watermelondb';

export interface DigestItem {
    type: 'plan' | 'confirmation' | 'suggestion' | 'birthday' | 'anniversary' | 'life_event' | 'memory' | 'interaction' | 'insight';
    priority: number;
    title: string;
    subtitle?: string;
    friendId?: string;
    friendName?: string;
    interactionId?: string;
    data?: Record<string, any>;
}

export interface DigestContent {
    items: DigestItem[];
    notificationTitle: string;
    notificationBody: string;
    shouldSend: boolean;
}

const ID_PREFIX = 'evening-digest';

export const EveningDigestChannel: NotificationChannel & {
    generateContent: () => Promise<DigestContent>,
    generateAndSave: () => Promise<DigestContent>,
    loadDigestForDate: (date: Date) => Promise<EveningDigest | null>,
    cancel: () => Promise<void>
} = {
    schedule: async (time: string = '19:00'): Promise<void> => {
        try {
            await EveningDigestChannel.cancel();

            // Parse time
            const [hourStr, minuteStr] = time.split(':');
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);

            if (isNaN(hour) || isNaN(minute)) {
                Logger.error('[EveningDigest] Invalid time:', time);
                return;
            }

            await Notifications.scheduleNotificationAsync({
                identifier: ID_PREFIX,
                content: {
                    title: "Your evening brief 🌙",
                    body: "Take a moment to review today's connections and plans.",
                    data: { type: 'evening-digest' },
                    sound: true,
                },
                trigger: {
                    hour,
                    minute,
                    repeats: true,
                } as any,
            });

            await notificationAnalytics.trackScheduled('evening-digest', ID_PREFIX, { time });
            Logger.info(`[EveningDigest] Scheduled for ${time}`);

        } catch (error) {
            Logger.error('[EveningDigest] Error scheduling:', error);
        }
    },

    cancel: async (): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(ID_PREFIX);
    },

    generateContent: async (): Promise<DigestContent> => {
        const focusData: FocusData = await FocusGenerator.generateFocusData();
        const items: DigestItem[] = [];

        // 1. Pending Confirmations / Today's Plans (Priority 100/70)
        focusData.pendingConfirmations.forEach(p => {
            const isToday = differenceInDays(new Date(p.interactionDate), new Date()) === 0;
            items.push({
                type: isToday ? 'plan' : 'confirmation',
                priority: isToday ? 100 : 70,
                title: p.title || 'Untitled Plan',
                subtitle: isToday ? `Today` : `Pending from ${new Date(p.interactionDate).toLocaleDateString()}`,
                interactionId: p.id,
                data: { status: p.status }
            });
        });

        // 2. Upcoming (Priority 90/30)
        focusData.upcomingDates.forEach(d => {
            const priority = d.daysUntil <= 1 ? 90 : (d.importance === 'critical' ? 80 : 30);
            items.push({
                type: d.type,
                priority,
                title: d.type === 'birthday' ? `${d.friend.name}'s Birthday` : (d.title || d.type),
                subtitle: d.daysUntil === 0 ? 'Today' : (d.daysUntil === 1 ? 'Tomorrow' : `In ${d.daysUntil} days`),
                friendId: d.friend.id,
                friendName: d.friend.name,
            });
        });

        // 3. Suggestions (Priority 50/40)
        focusData.suggestions.forEach(s => {
            items.push({
                type: 'suggestion',
                priority: s.urgency === 'critical' ? 60 : (s.urgency === 'high' ? 50 : 40),
                title: s.title,
                subtitle: s.subtitle,
                friendId: s.friendId,
                data: { suggestionId: s.id }
            });
        });

        // Sort items by priority desc
        items.sort((a, b) => b.priority - a.priority);

        const highValueItems = items.filter(i => i.priority >= 40);
        const shouldSend = highValueItems.length > 0;

        return {
            items,
            notificationTitle: "Your evening brief 🌙",
            notificationBody: "Tap to view summary",
            shouldSend
        };
    },

    /**
     * Generate content AND save it to the database for this day
     */
    generateAndSave: async (): Promise<DigestContent> => {
        const content = await EveningDigestChannel.generateContent();

        const today = startOfDay(new Date()).getTime();

        try {
            // Check if we already have a digest for today
            const existing = await database
                .get<EveningDigest>('evening_digests')
                .query(Q.where('digest_date', today))
                .fetch();

            await database.write(async () => {
                if (existing.length > 0) {
                    // Update existing
                    await existing[0].update(d => {
                        d.itemsJson = JSON.stringify(content.items);
                        d.notificationTitle = content.notificationTitle;
                        d.notificationBody = content.notificationBody;
                        d.itemCount = content.items.length;
                    });
                } else {
                    // Create new
                    await database.get<EveningDigest>('evening_digests').create(d => {
                        d.digestDate = today;
                        d.itemsJson = JSON.stringify(content.items);
                        d.notificationTitle = content.notificationTitle;
                        d.notificationBody = content.notificationBody;
                        d.itemCount = content.items.length;
                    });
                }
            });

            Logger.info(`[EveningDigest] Saved digest for ${new Date(today).toLocaleDateString()} with ${content.items.length} items`);
        } catch (error) {
            Logger.error('[EveningDigest] Error saving digest:', error);
        }

        return content;
    },

    /**
     * Load a saved digest for a specific date
     */
    loadDigestForDate: async (date: Date): Promise<EveningDigest | null> => {
        try {
            const dayStart = startOfDay(date).getTime();
            const digests = await database
                .get<EveningDigest>('evening_digests')
                .query(Q.where('digest_date', dayStart))
                .fetch();

            return digests.length > 0 ? digests[0] : null;
        } catch (error) {
            Logger.error('[EveningDigest] Error loading digest:', error);
            return null;
        }
    },

    handleTap: async (data: any, router: any) => {
        const { UIEventBus } = await import('@/shared/services/ui-event-bus');

        // Navigate first to ensure stable route where GlobalModals is mounted
        if (router.canGoBack()) router.dismissAll();
        router.replace('/dashboard');

        // Generate content (non-blocking save)
        try {
            const content = await EveningDigestChannel.generateContent();

            // Open the sheet after navigation settles
            setTimeout(() => {
                UIEventBus.emit({ type: 'OPEN_DIGEST_SHEET', items: content.items });
                notificationAnalytics.trackActionCompleted('evening-digest', 'open_sheet');
            }, 500);

            // Save to database in background (don't block UI)
            EveningDigestChannel.generateAndSave().catch(err => {
                Logger.warn('[EveningDigest] Background save failed:', err);
            });

        } catch (error) {
            Logger.error('[EveningDigest] Error generating content on tap:', error);
            // Still try to open the sheet with empty state
            setTimeout(() => {
                UIEventBus.emit({ type: 'OPEN_DIGEST_SHEET', items: [] });
            }, 500);
        }
    },

    ensureScheduled: async (): Promise<void> => {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            const digestScheduled = scheduled.find(n => n.identifier === ID_PREFIX);

            if (!digestScheduled) {
                Logger.info('[EveningDigest] Not scheduled, scheduling now...');
                await EveningDigestChannel.schedule();
            } else {
                // Optional: Check if time matches? 
                // For now, existence is enough.
            }
        } catch (error) {
            Logger.error('[EveningDigest] Error in ensureScheduled:', error);
        }
    }
};
