
/**
 * Smart Suggestions Channel
 * Handles AI-driven friend outreach suggestions
 * Integrates: Social Battery, Suggestion Engine, Portfolio Insights, Time-of-Day
 */

import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import UserProfile from '@/db/models/UserProfile';
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from '../notification-analytics';
import { notificationStore } from '../notification-store';
import { NotificationChannel, NotificationPreferences } from '../../types';
import { generateSuggestion } from '@/modules/interactions';
import { calculateCurrentScore } from '@/modules/intelligence';
import { HydratedFriend } from '@/types/hydrated';
import { Suggestion } from '@/shared/types/common';

const ID_PREFIX = 'smart-suggestion';
const MIN_HOURS_BETWEEN_NOTIFICATIONS = 2;

// Helper to check quiet hours
function isQuietHours(prefs: NotificationPreferences): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    if (prefs.quietHoursStart > prefs.quietHoursEnd) {
        return currentHour >= prefs.quietHoursStart || currentHour < prefs.quietHoursEnd;
    }
    return currentHour >= prefs.quietHoursStart && currentHour < prefs.quietHoursEnd;
}

// Helper to determine if we should respect battery
function shouldRespectBattery(
    batteryLevel: number | null,
    urgency: Suggestion['urgency'],
    prefs: NotificationPreferences
): boolean {
    if (urgency === 'critical') return true;
    if (!prefs.respectBattery) return true;
    if (batteryLevel === null) return urgency === 'high';
    if (batteryLevel < 30) return urgency === 'high';
    if (batteryLevel < 50) return urgency === 'high' || urgency === 'medium';
    return true;
}

// Helper to calculate spreads
function calculateSpreadDelays(count: number, prefs: NotificationPreferences): number[] {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const timeSlots: number[] = [];

    // Morning (9-11)
    if (currentHour < 9) timeSlots.push(9 - currentHour);
    // Midday (12-2)
    if (currentHour < 12) {
        const hours = 12 - currentHour;
        if (hours >= MIN_HOURS_BETWEEN_NOTIFICATIONS) timeSlots.push(hours);
    }
    // Afternoon (3-5)
    if (currentHour < 15) {
        const hours = 15 - currentHour;
        if (hours >= MIN_HOURS_BETWEEN_NOTIFICATIONS) timeSlots.push(hours);
    }
    // Evening (6-8)
    if (currentHour < 18 && prefs.quietHoursStart > 18) {
        const hours = 18 - currentHour;
        if (hours >= MIN_HOURS_BETWEEN_NOTIFICATIONS) timeSlots.push(hours);
    }

    // Fallback: spread across remaining time
    if (timeSlots.length === 0) {
        const hoursUntilQuiet = prefs.quietHoursStart - currentHour;
        if (hoursUntilQuiet > MIN_HOURS_BETWEEN_NOTIFICATIONS) {
            for (let i = 1; i <= count && i * MIN_HOURS_BETWEEN_NOTIFICATIONS < hoursUntilQuiet; i++) {
                timeSlots.push(i * MIN_HOURS_BETWEEN_NOTIFICATIONS);
            }
        }
    }

    // Convert to minutes with noise
    return timeSlots.slice(0, count).map(hours => {
        const base = hours * 60 - currentMinute;
        const noise = Math.floor(Math.random() * 30) - 15;
        return Math.max(MIN_HOURS_BETWEEN_NOTIFICATIONS * 60 + 1, base + noise); // Ensure at least min gap
    });
}

export const SmartSuggestionsChannel: NotificationChannel & {
    evaluateAndSchedule: () => Promise<void>
} = {
    schedule: async (): Promise<void> => {
        // This method might be used for manual single scheduling, 
        // but the main logic is in evaluateAndSchedule.
        await SmartSuggestionsChannel.evaluateAndSchedule();
    },

    evaluateAndSchedule: async (): Promise<void> => {
        Logger.info('[SmartSuggestions] Evaluating...');

        // 1. Cooldown check
        const lastTime = await notificationStore.getLastSmartNotificationTime();
        if (lastTime) {
            const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
            if (hoursSince < MIN_HOURS_BETWEEN_NOTIFICATIONS) {
                Logger.debug('[SmartSuggestions] Cooldown active, skipping');
                return;
            }
        }

        // 2. Preferences & Limits
        const prefs = await notificationStore.getPreferences();
        if (isQuietHours(prefs)) {
            Logger.debug('[SmartSuggestions] Quiet hours, skipping');
            return;
        }

        const todayStats = await notificationStore.getSmartNotificationCount();
        const today = new Date().toDateString();
        let todayCount = (todayStats?.date === today) ? todayStats.count : 0;

        const limits = { light: 1, moderate: 2, proactive: 4 };
        const maxAllowed = limits[prefs.frequency];

        // Check scheduled for today
        const scheduledStats = await notificationStore.getScheduledSmartNotifications();
        const alreadyScheduledCount = (scheduledStats?.date === today) ? scheduledStats.ids.length : 0;

        const remainingSlots = maxAllowed - alreadyScheduledCount;
        if (remainingSlots <= 0) return;

        // 3. Battery Check
        const profiles = await database.get<UserProfile>('user_profile').query().fetch();
        const batteryLevel = profiles[0]?.socialBatteryCurrent ?? null;

        // 4. Generate Suggestions
        const suggestions: Suggestion[] = [];
        const friends = await database.get<Friend>('friends').query().fetch();

        for (const friend of friends) {
            // Junction check
            const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query(Q.where('friend_id', friend.id)).fetch();
            const iIds = interactionFriends.map(ifriend => ifriend.interactionId);

            let lastInteractionDate;
            let interactionCount = 0;
            let recentInteractions: Interaction[] = [];

            if (iIds.length > 0) {
                const ints = await database.get<Interaction>('interactions').query(Q.where('id', Q.oneOf(iIds)), Q.where('status', 'completed')).fetch();
                const sorted = ints.filter(i => i.interactionDate).sort((a, b) => b.interactionDate.getTime() - a.interactionDate.getTime());
                lastInteractionDate = sorted[0]?.interactionDate;
                interactionCount = sorted.length;
                recentInteractions = sorted.slice(0, 5);
            }

            // Dedupe: 24h
            if (lastInteractionDate && (Date.now() - lastInteractionDate.getTime()) < 24 * 60 * 60 * 1000) {
                continue;
            }

            const currentScore = calculateCurrentScore(friend);
            // Momentum logic
            const lastUpdated = friend.momentumLastUpdated || friend.createdAt || new Date();
            const daysSince = (Date.now() - lastUpdated.getTime()) / 86400000;
            const momentumScore = Math.max(0, friend.momentumScore - daysSince);

            const suggestion = await generateSuggestion({
                friend: friend as unknown as HydratedFriend,
                currentScore,
                lastInteractionDate: lastInteractionDate ?? null,
                interactionCount,
                momentumScore,
                recentInteractions
            });

            if (suggestion) suggestions.push(suggestion);
        }

        // 5. Select & Schedule
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = suggestions.sort((a, b) => urgencyOrder[a.urgency || 'medium'] - urgencyOrder[b.urgency || 'medium']);

        const eligible = sorted.filter(s => shouldRespectBattery(batteryLevel, s.urgency, prefs));
        const toSchedule = eligible.slice(0, remainingSlots);
        const delays = calculateSpreadDelays(toSchedule.length, prefs);

        let scheduledIds = (scheduledStats?.date === today) ? [...scheduledStats.ids] : [];

        for (let i = 0; i < toSchedule.length; i++) {
            const s = toSchedule[i];
            const delay = delays[i] || (i + 1) * 60; // fallback 1 hour spacing

            const id = `${ID_PREFIX}-${s.id}`;
            const trigger = new Date(Date.now() + delay * 60000);

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: s.title,
                    body: s.subtitle,
                    data: {
                        type: 'friend-suggestion',
                        friendId: s.friendId,
                        suggestionId: s.id
                    }
                },
                trigger: trigger as any
            });

            await notificationAnalytics.trackScheduled('friend-suggestion', id, {
                friendId: s.friendId,
                score: s.score,
                delayMinutes: delay
            });

            scheduledIds.push(id);
            todayCount++;
        }

        // Update store
        await notificationStore.setScheduledSmartNotifications(today, scheduledIds);
        await notificationStore.setSmartNotificationCount(today, todayCount);
        await notificationStore.setLastSmartNotificationTime(Date.now());

        Logger.info(`[SmartSuggestions] Scheduled ${toSchedule.length} notifications.`);
    },

    cancel: async (id: string = ID_PREFIX): Promise<void> => {
        // Cancel all starting with prefix is safer
        const all = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of all) {
            if (n.identifier.startsWith(ID_PREFIX)) {
                await Notifications.cancelScheduledNotificationAsync(n.identifier);
            }
        }
    },

    handleTap: (data, router) => {
        if (data.friendId) {
            router.push(`/friends/${data.friendId}`);
            notificationAnalytics.trackActionCompleted('friend-suggestion', 'view_profile');
        } else {
            router.replace('/dashboard');
        }
    }
};
