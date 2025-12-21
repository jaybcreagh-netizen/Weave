
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
import { NotificationChannel, NotificationPreferences } from '@/modules/notifications';
import { generateSuggestion } from '@/modules/interactions';
import { calculateCurrentScore } from '@/modules/intelligence';
import { HydratedFriend } from '@/types/hydrated';
import { Suggestion } from '@/shared/types/common';
import { applySeasonLimit, shouldSendNotification } from '../season-notifications.service';
import { NOTIFICATION_CONFIG, NotificationConfigItem } from '../../notification.config';

const ID_PREFIX = 'smart-suggestion';
const MIN_HOURS_BETWEEN_NOTIFICATIONS = 2;

// Helper to check quiet hours
// Helper to check quiet hours
function isQuietHours(date: Date, prefs: NotificationPreferences): boolean {
    const hour = date.getHours();
    const start = prefs.quietHoursStart;
    const end = prefs.quietHoursEnd;

    // e.g. Start 23, End 7. 
    // 23, 0...6 are quiet.
    if (start > end) {
        return hour >= start || hour < end;
    }
    // e.g. Start 1, End 5.
    // 1...4 are quiet.
    return hour >= start && hour < end;
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

// Helper to calculate spreads with STRICT quiet hours
function calculateSpreadDelays(count: number, prefs: NotificationPreferences): number[] {
    const delays: number[] = [];
    const minGapMs = MIN_HOURS_BETWEEN_NOTIFICATIONS * 60 * 60 * 1000;

    let simulatedTime = Date.now();

    for (let i = 0; i < count; i++) {
        // Find next valid slot
        let attempts = 0;
        // Start looking from MIN_GAP after last scheduled (or now)
        // Ensure first one is at least a bit in future? 
        // Existing logic said "remaining time". 
        // Let's just step forward.

        simulatedTime += minGapMs;

        // If falls in quiet hours, push to end of quiet hours
        while (isQuietHours(new Date(simulatedTime), prefs) && attempts < 24) {
            // Advance by 1 hour until out of quiet zone
            simulatedTime += 60 * 60 * 1000;
            attempts++;
        }

        // Add random noise (minus 15 to plus 15 mins)
        const noise = (Math.floor(Math.random() * 30) - 15) * 60 * 1000;
        const targetTime = simulatedTime + noise;

        const delayMs = targetTime - Date.now();
        // Ensure positive delay
        delays.push(Math.max(1, Math.round(delayMs / 60000)));
    }

    return delays;
}

export const SmartSuggestionsChannel: NotificationChannel & {
    evaluateAndSchedule: (config?: NotificationConfigItem) => Promise<void>
} = {
    schedule: async (): Promise<void> => {
        // This method might be used for manual single scheduling, 
        // but the main logic is in evaluateAndSchedule.
        const suggestionsConfig = NOTIFICATION_CONFIG['smart-suggestions'];
        await SmartSuggestionsChannel.evaluateAndSchedule(suggestionsConfig);
    },

    evaluateAndSchedule: async (injectedConfig?: NotificationConfigItem): Promise<void> => {
        Logger.info('[SmartSuggestions] Evaluating...');

        // Use injected effective config (from Orchestrator) or fall back to raw
        const config = injectedConfig || NOTIFICATION_CONFIG['smart-suggestions'];

        if (!config.enabled) {
            Logger.debug('[SmartSuggestions] Disabled in config');
            return;
        }

        // 0. Check if this type is suppressed (ignored 3+ times)
        if (await notificationStore.isTypeSuppressed('friend-suggestion')) {
            Logger.info('[SmartSuggestions] Suppressed due to repeated ignores');
            return;
        }

        // 1. Check global daily budget
        // Use config cost
        const cost = config.limits.dailyBudgetCost;
        const budget = await notificationStore.getDailyBudget();
        if (cost > 0 && budget.used + cost > budget.limit) {
            Logger.info('[SmartSuggestions] Daily budget exhausted');
            return;
        }

        // 2. Cooldown check
        const lastTime = await notificationStore.getLastSmartNotificationTime();
        if (lastTime) {
            const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

            // Use schedule.hours (frequency) as the primary cooldown if available (handling overrides), 
            // fallback to limits.cooldownHours or default constant.
            // This ensures "Every 4 hours" override actually works.
            const frequency = config.schedule?.hours;
            const cooldown = frequency || config.limits.cooldownHours || MIN_HOURS_BETWEEN_NOTIFICATIONS;

            if (hoursSince < cooldown) {
                Logger.debug(`[SmartSuggestions] Cooldown active (${hoursSince.toFixed(1)}h < ${cooldown}h), skipping`);
                return;
            }
        }

        // 2. Preferences & Limits
        const prefs = await notificationStore.getPreferences();
        if (isQuietHours(new Date(), prefs)) {
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

        // 3. Battery Check & Season Limits
        const profiles = await database.get<UserProfile>('user_profile').query().fetch();
        const profile = profiles[0];
        const batteryLevel = profile?.socialBatteryCurrent ?? null;
        const currentSeason = profile?.currentSocialSeason;

        // Apply season limits
        const seasonAdjustedLimit = applySeasonLimit(maxAllowed, currentSeason);
        const remainingSlots = seasonAdjustedLimit - alreadyScheduledCount;

        if (remainingSlots <= 0) return;

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

            // Dedupe: 24h cooldown for recent interactions
            if (lastInteractionDate && (Date.now() - lastInteractionDate.getTime()) < 24 * 60 * 60 * 1000) {
                continue;
            }

            // Skip friends with planned weaves in the next 7 days
            if (iIds.length > 0) {
                const now = Date.now();
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                const plannedWeaves = await database.get<Interaction>('interactions')
                    .query(
                        Q.where('id', Q.oneOf(iIds)),
                        Q.where('status', 'planned'),
                        Q.where('interaction_date', Q.gt(now)),
                        Q.where('interaction_date', Q.lt(now + sevenDaysMs))
                    ).fetch();
                if (plannedWeaves.length > 0) {
                    continue;
                }
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

        // Filter by battery AND season
        const eligible = sorted.filter(s => {
            const batteryOk = shouldRespectBattery(batteryLevel, s.urgency, prefs);
            const seasonOk = shouldSendNotification(currentSeason, 'friend-suggestion', s.category as any, s.urgency); // Type assertion for safety
            return batteryOk && seasonOk;
        });

        const toSchedule = eligible.slice(0, remainingSlots);
        const delays = calculateSpreadDelays(toSchedule.length, prefs);

        let scheduledIds = (scheduledStats?.date === today) ? [...scheduledStats.ids] : [];

        for (let i = 0; i < toSchedule.length; i++) {
            const s = toSchedule[i];
            const delay = delays[i] || (i + 1) * 60; // fallback 1 hour spacing

            const id = `${ID_PREFIX}-${s.id}`;
            const trigger = new Date(Date.now() + delay * 60000);

            // Use Config Templates
            const title = config.templates.default.title.replace('{{title}}', s.title);
            const body = config.templates.default.body.replace('{{subtitle}}', s.subtitle || '');

            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title,
                    body,
                    data: {
                        type: 'friend-suggestion',
                        friendId: s.friendId,
                        suggestionId: s.id
                    }
                },
                // Expo types for trigger are strict/complex
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: trigger
                }
            });

            await notificationAnalytics.trackScheduled('friend-suggestion', id, {
                friendId: s.friendId,
                score: s.score,
                delayMinutes: delay
            });

            // Increment global daily budget
            if (cost > 0) {
                await notificationStore.checkAndIncrementBudget();
            }

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
            router.push(`/friend-profile?friendId=${data.friendId}`);
            notificationAnalytics.trackActionCompleted('friend-suggestion', 'view_profile');
        } else {
            router.replace('/dashboard');
        }
    }
};
