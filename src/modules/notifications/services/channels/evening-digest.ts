import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { NotificationChannel } from '../../types';
import { FocusGenerator, FocusData } from '@/modules/intelligence/services/focus-generator';
import { notificationStore } from '../notification-store';
import { differenceInDays } from 'date-fns';

export interface DigestItem {
    type: 'plan' | 'confirmation' | 'suggestion' | 'birthday' | 'anniversary' | 'life_event' | 'memory';
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

            // Standard daily schedule
            // We schedule a "check" notification that will trigger standard "Evening Check-in" 
            // OR we must accept that content is static "Check your evening digest" 
            // UNLESS we use background fetch to update the notification body daily.
            // For Weave's current architecture (local, no background fetch guaranteed), 
            // we will use a GENERIC message that encourages opening.
            // "Your evening check-in is ready. Tap to view today's summary."
            // AND we generate the *actual* content (DigestContent) only when the user TAPS (in handleTap).

            // Wait, the Requirement said: "Notification Copy Generation: { title: "Sarah's birthday tomorrow", body: "Tap to see details" }"
            // To do this dynamically without server/background fetch is hard on Expo/iOS.
            // HOWEVER, we CAN schedule specific notifications if we know the events ahead of time (like birthdays).
            // But plans change.
            // Compromise: We schedule a recurring notification with a generic message,
            // OR the user accepts that it might be slightly stale if we schedule it 24h ahead?
            // Actually, we can "reschedule after each digest fires" (from requirements).
            // This suggests validation happens when the app is OPEN.
            // If the app is NOT opened, the recurring notification fires with generic or last-known content.

            // For V1 of Digest, let's stick to a reliable recurring notification with a static, inviting message.
            // "Your evening brief is ready 🌙"
            // "Take a moment to review today's connections and plans."

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
        // FocusGenerator.getImportantPlans includes both.
        // We separate them by date if needed, or Treat 'pending' as high priority.
        focusData.pendingConfirmations.forEach(p => {
            const isToday = differenceInDays(new Date(p.interactionDate), new Date()) === 0;
            items.push({
                type: isToday ? 'plan' : 'confirmation',
                priority: isToday ? 100 : 70, // Today's plans strictly higher
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

        // Determine if meaningful
        // "Nothing meaningful" criteria: No plans, no birthdays <3 days, no crit events, no high urgency suggestions.
        // Simplified: If items length > 0, it's meaningful (since we filter upstream partially).
        // But let's check priorities.
        const highValueItems = items.filter(i => i.priority >= 40);
        const shouldSend = highValueItems.length > 0;

        return {
            items,
            notificationTitle: "Your evening brief 🌙", // Dynamic copy not used for static schedule
            notificationBody: "Tap to view summary",
            shouldSend
        };
    },

    handleTap: async (data: any, router: any) => {
        // We need to OPEN the digest sheet.
        // We'll use UIStore to toggle visibility and pass data.
        // Lazy load store
        const { useUIStore } = require('@/stores/uiStore');
        const { Alert } = require('react-native');

        // Check time restriction (7 PM - 9 PM) unless it's a test
        const now = new Date();
        const currentHour = now.getHours();
        const isEvening = currentHour >= 19 && currentHour < 21; // 7 PM to 8:59 PM
        const isTest = data?.isTest === true;

        if (!isEvening && !isTest) {
            Logger.info('[EveningDigest] Tap ignored outside 7-9 PM window');
            // Optional: Show an alert explaining why it didn't open?
            // "The evening digest is only available between 7 PM and 9 PM."
            // User requirement: "I only want the evening digest to appear in the evening - 7-9pm"
            // It's better to give feedback than do nothing if they tap the notification.
            Alert.alert(
                'Evening Digest',
                'The evening digest is only available between 7:00 PM and 9:00 PM.'
            );
            return;
        }

        // Generate FRESH content on tap to ensure it's up to date
        // (e.g. if user completed a plan since notification fired)
        try {
            const content = await EveningDigestChannel.generateContent();

            // Verify if still meaningful? 
            // Even if empty, if user TAPPED, we should show the sheet (maybe empty state).

            if (router.canGoBack()) router.dismissAll();
            // Navigate to home first or stay current?
            // DigestSheet is likely global or on Home.
            // If global modal, we can just open it.

            useUIStore.getState().openDigestSheet(content.items);
            notificationAnalytics.trackActionCompleted('evening-digest', 'open_sheet');

        } catch (error) {
            Logger.error('[EveningDigest] Error generating content on tap:', error);
            router.replace('/dashboard');
        }
    }
};
