import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '@/modules/notifications';
import { FocusGenerator, FocusData } from '@/modules/intelligence';
import { notificationStore } from '../notification-store';
import { differenceInDays, startOfDay, isSameDay, addDays } from 'date-fns';
import { database } from '@/db';
import EveningDigest from '@/db/models/EveningDigest';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import Interaction from '@/db/models/Interaction';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { NOTIFICATION_CONFIG } from '../../notification.config';

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

/**
 * New structured content for the mindful Evening Check-in
 * Limits items to prevent overwhelm and focuses on engagement
 */
export interface EveningCheckinContent {
    /** Whether user has checked in battery today */
    hasBatteryCheckinToday: boolean;

    /** Today's weaves - max 3 each */
    todaysWeaves: {
        completed: DigestItem[];
        unconfirmed: DigestItem[];
    };

    /** Tomorrow only - max 2 items (plans, birthdays) */
    tomorrow: DigestItem[];

    /** Single highest-priority suggestion (nullable) */
    topSuggestion: DigestItem | null;

    /** True if no content at all (show "All Quiet" state) */
    isEmpty: boolean;
}

const ID_PREFIX = 'evening-digest';

export const EveningDigestChannel: NotificationChannel & {
    generateContent: () => Promise<DigestContent>,
    generateEveningCheckinContent: () => Promise<EveningCheckinContent>,
    generateAndSave: () => Promise<DigestContent>,
    loadDigestForDate: (date: Date) => Promise<EveningDigest | null>,
    cancel: () => Promise<void>
} = {
    schedule: async (time?: string): Promise<void> => {
        try {
            const config = NOTIFICATION_CONFIG['evening-digest'];
            if (!config.enabled) {
                Logger.info('[EveningDigest] Disabled in config');
                return;
            }

            await EveningDigestChannel.cancel();

            let targetHour = config.schedule.hour ?? 19;
            let targetMinute = config.schedule.minute ?? 0;

            // Allow override if explicitly passed (e.g. from user prefs which currently passes '19:00')
            // However, the config should ideally drive this. 
            // If we want to strictly follow config, we ignore the passed param if config says otherwise,
            // OR we treat the passed param as a dynamic override.
            // For now, let's respect the user pref override if it was part of the original logic,
            // but default to config.
            if (time) {
                const [hourStr, minuteStr] = time.split(':');
                const hour = parseInt(hourStr, 10);
                const minute = parseInt(minuteStr, 10);
                if (!isNaN(hour) && !isNaN(minute)) {
                    targetHour = hour;
                    targetMinute = minute;
                }
            }

            const title = config.templates.default.title;
            const body = config.templates.default.body;

            await Notifications.scheduleNotificationAsync({
                identifier: ID_PREFIX,
                content: {
                    title,
                    body,
                    data: { type: 'evening-digest' },
                    sound: true,
                },
                trigger: {
                    hour: targetHour,
                    minute: targetMinute,
                    repeats: true,
                } as any,
            });

            const timeStr = `${targetHour.toString().padStart(2, '0')}:${targetMinute.toString().padStart(2, '0')}`;
            await notificationAnalytics.trackScheduled('evening-digest', ID_PREFIX, { time: timeStr });
            Logger.info(`[EveningDigest] Scheduled for ${timeStr}`);

        } catch (error) {
            Logger.error('[EveningDigest] Error scheduling:', error);
        }
    },

    cancel: async (): Promise<void> => {
        // Nuclear cleanup: cancel ALL evening digest related notifications
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const toCancel = scheduled.filter(n =>
            n.identifier === ID_PREFIX ||
            n.identifier.startsWith('evening-digest') ||
            n.content.data?.type === 'evening-digest' ||
            n.content.title === "Your evening brief 🌙"
        );

        if (toCancel.length > 0) {
            Logger.info(`[EveningDigest] Cancelling ${toCancel.length} notification(s)`);
            await Promise.all(
                toCancel.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
            );
        }
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
     * Generate structured content for the mindful Evening Check-in
     * Limits items to prevent overwhelm and focuses on engagement
     */
    generateEveningCheckinContent: async (): Promise<EveningCheckinContent> => {
        const today = new Date();
        const todayStart = startOfDay(today);
        const tomorrow = addDays(todayStart, 1);
        const tomorrowEnd = addDays(todayStart, 2);

        // 1. Check if user has battery check-in today
        let hasBatteryCheckinToday = false;
        try {
            const todayLogs = await database
                .get<SocialBatteryLog>('social_battery_logs')
                .query(
                    Q.where('timestamp', Q.gte(todayStart.getTime())),
                    Q.where('timestamp', Q.lt(tomorrow.getTime()))
                )
                .fetchCount();
            hasBatteryCheckinToday = todayLogs > 0;
        } catch (error) {
            Logger.warn('[EveningCheckin] Error checking battery logs:', error);
        }

        // 2. Get today's weaves (completed and unconfirmed)
        const todaysCompleted: DigestItem[] = [];
        const todaysUnconfirmed: DigestItem[] = [];

        try {
            const todaysInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('interaction_date', Q.gte(todayStart.getTime())),
                    Q.where('interaction_date', Q.lt(tomorrow.getTime()))
                )
                .fetch();

            await Promise.all(todaysInteractions.map(async (interaction) => {
                let title = interaction.title;

                if (!title) {
                    try {
                        const joinRecords = await interaction.interactionFriends.fetch();
                        const friendIds = joinRecords.map(r => r.friendId);

                        let friendNames = '';
                        if (friendIds.length > 0) {
                            const friends = await database.get<Friend>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();
                            friendNames = friends.map(f => f.name).join(', ');
                        }

                        const type = (interaction.interactionType || 'weave').replace(/_/g, ' ');
                        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

                        title = friendNames ? `${capitalizedType} with ${friendNames}` : capitalizedType;
                    } catch (e) {
                        title = 'Untitled Weave';
                    }
                }

                const item: DigestItem = {
                    type: interaction.status === 'completed' ? 'interaction' : 'plan',
                    priority: interaction.status === 'completed' ? 80 : 90,
                    title: title,
                    subtitle: interaction.status === 'completed' ? 'Completed today' : 'Needs confirmation',
                    interactionId: interaction.id,
                    data: { status: interaction.status }
                };

                if (interaction.status === 'completed') {
                    todaysCompleted.push(item);
                } else if (interaction.status === 'planned') {
                    todaysUnconfirmed.push(item);
                }
            }));
        } catch (error) {
            Logger.warn('[EveningCheckin] Error fetching today\'s interactions:', error);
        }

        // 3. Get tomorrow's items (plans + birthdays)
        const tomorrowItems: DigestItem[] = [];

        try {
            // Tomorrow's planned interactions
            const tomorrowInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('interaction_date', Q.gte(tomorrow.getTime())),
                    Q.where('interaction_date', Q.lt(tomorrowEnd.getTime())),
                    Q.where('status', 'planned')
                )
                .fetch();

            await Promise.all(tomorrowInteractions.slice(0, 2).map(async (interaction) => {
                let title = interaction.title;

                if (!title) {
                    try {
                        const joinRecords = await interaction.interactionFriends.fetch();
                        const friendIds = joinRecords.map(r => r.friendId);

                        let friendNames = '';
                        if (friendIds.length > 0) {
                            const friends = await database.get<Friend>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();
                            friendNames = friends.map(f => f.name).join(', ');
                        }

                        const type = (interaction.interactionType || 'weave').replace(/_/g, ' ');
                        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

                        title = friendNames ? `${capitalizedType} with ${friendNames}` : capitalizedType;
                    } catch (e) {
                        title = 'Planned Weave';
                    }
                }

                tomorrowItems.push({
                    type: 'plan',
                    priority: 85,
                    title: title,
                    subtitle: 'Tomorrow',
                    interactionId: interaction.id,
                });
            }));
        } catch (error) {
            Logger.warn('[EveningCheckin] Error fetching tomorrow\'s plans:', error);
        }

        // Also add tomorrow's birthdays from focus data
        try {
            const focusData = await FocusGenerator.generateFocusData();
            const tomorrowBirthdays = focusData.upcomingDates.filter(
                d => d.daysUntil === 1 && (d.type === 'birthday' || d.type === 'anniversary')
            );

            tomorrowBirthdays.slice(0, 2 - tomorrowItems.length).forEach(d => {
                tomorrowItems.push({
                    type: d.type,
                    priority: 95,
                    title: d.type === 'birthday'
                        ? `${d.friend.name}'s Birthday`
                        : `Anniversary with ${d.friend.name}`,
                    subtitle: 'Tomorrow',
                    friendId: d.friend.id,
                    friendName: d.friend.name,
                });
            });
        } catch (error) {
            Logger.warn('[EveningCheckin] Error fetching tomorrow\'s dates:', error);
        }

        // 4. Get single top suggestion
        let topSuggestion: DigestItem | null = null;

        try {
            const focusData = await FocusGenerator.generateFocusData();
            if (focusData.suggestions.length > 0) {
                // Sort by urgency and take the top one
                const sorted = [...focusData.suggestions].sort((a, b) => {
                    const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    return (urgencyOrder[b.urgency || 'low'] || 1) - (urgencyOrder[a.urgency || 'low'] || 1);
                });

                const top = sorted[0];
                topSuggestion = {
                    type: 'suggestion',
                    priority: top.urgency === 'critical' ? 60 : (top.urgency === 'high' ? 50 : 40),
                    title: top.title,
                    subtitle: top.subtitle,
                    friendId: top.friendId,
                    data: { suggestionId: top.id }
                };
            }
        } catch (error) {
            Logger.warn('[EveningCheckin] Error fetching suggestions:', error);
        }

        // Calculate isEmpty
        const totalItems =
            todaysCompleted.length +
            todaysUnconfirmed.length +
            tomorrowItems.length +
            (topSuggestion ? 1 : 0);

        const isEmpty = totalItems === 0 && hasBatteryCheckinToday;

        return {
            hasBatteryCheckinToday,
            todaysWeaves: {
                completed: todaysCompleted.slice(0, 3), // Max 3
                unconfirmed: todaysUnconfirmed.slice(0, 3), // Max 3
            },
            tomorrow: tomorrowItems.slice(0, 2), // Max 2
            topSuggestion,
            isEmpty,
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

            // Get user's preferred time (default 19:00)
            const prefs = await notificationStore.getPreferences();
            const userTime = prefs.digestTime || '19:00';
            const [prefHour, prefMinute] = userTime.split(':').map(Number);

            if (!digestScheduled) {
                Logger.info('[EveningDigest] Not scheduled, scheduling now...');
                await EveningDigestChannel.schedule(userTime);
            } else {
                // Check if scheduled time matches user preference
                const trigger = digestScheduled.trigger as { hour?: number; minute?: number } | undefined;

                // Also check for "ghosts" - notifications with same type but different ID
                const ghosts = scheduled.filter(n =>
                    (n.content.data?.type === 'evening-digest' || n.content.title === "Your evening brief 🌙") &&
                    n.identifier !== ID_PREFIX
                );

                if (ghosts.length > 0) {
                    Logger.warn(`[EveningDigest] Found ${ghosts.length} ghost notifications. Cancelling...`);
                    await Promise.all(ghosts.map(g => Notifications.cancelScheduledNotificationAsync(g.identifier)));
                }

                if (trigger && (trigger.hour !== prefHour || trigger.minute !== prefMinute)) {
                    Logger.info(`[EveningDigest] Time mismatch (scheduled: ${trigger.hour}:${trigger.minute}, preferred: ${userTime}), rescheduling...`);
                    await EveningDigestChannel.schedule(userTime);
                }
            }
        } catch (error) {
            Logger.error('[EveningDigest] Error in ensureScheduled:', error);
        }
    }
};
