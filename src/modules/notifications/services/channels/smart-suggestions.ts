
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
import { getLastAppOpenTimestamp } from '@/shared/services/analytics.service';
import { notificationAnalytics } from '../notification-analytics';
import { notificationStore } from '../notification-store';
import { NotificationChannel, NotificationPreferences } from '../../types';
import { generateSuggestion } from '@/modules/interactions/services/suggestion-engine';
import { fetchSuggestionSurface } from '@/modules/interactions/services/SuggestionFacade';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import { getRecentlySurfacedFocusSuggestionIds } from '@/modules/home/services/focus-suggestion-telemetry.service';
import { HydratedFriend } from '@/types/hydrated';
import { Suggestion } from '@/shared/types/common';
import { isOpportunityNotificationsEnabled } from '@/modules/interactions/services/opportunity-system/flags';
import {
    getSmartSuggestionDailyLimit,
    resolveSuggestionFrequency,
} from '@/modules/interactions/services/opportunity-system/suggestion-frequency';
import {
    getTimingWindowForDate,
    isWindowWithinPreferences,
    resolvePreferredSuggestionWindows,
} from '@/modules/interactions/services/opportunity-system/personal-timing';
import { applySeasonLimit, shouldSendNotification } from '../season-notifications.service';
import { NOTIFICATION_CONFIG, NOTIFICATION_TIMING, NotificationConfigItem } from '../../notification.config';

const ID_PREFIX = 'smart-suggestion';
const MIN_SELECTOR_NOTIFICATION_SCORE = 60;

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
    const minGapMs = NOTIFICATION_TIMING.smartSuggestions.minHoursBetween * 60 * 60 * 1000;

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

function isPushEligibleSuggestion(suggestion: Suggestion): boolean {
    if (!suggestion.friendId) return false;

    if (
        suggestion.action.type === 'reflect'
        || suggestion.action.type === 'oracle'
        || suggestion.action.type === 'life-event'
        || suggestion.action.type === 'tier-review'
    ) {
        return false;
    }

    if (
        suggestion.category === 'daily-reflect'
        || suggestion.category === 'wildcard'
        || suggestion.category === 'portfolio'
        || suggestion.category === 'insight'
        || suggestion.category === 'life-event'
    ) {
        return false;
    }

    return true;
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

        const userEnabled = await notificationStore.isSmartNotificationsEnabled();
        if (!userEnabled) {
            Logger.info('[SmartSuggestions] Disabled by user setting');
            await SmartSuggestionsChannel.cancel();
            return;
        }

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
            const cooldown = frequency || config.limits.cooldownHours || NOTIFICATION_TIMING.smartSuggestions.minHoursBetween;

            if (hoursSince < cooldown) {
                Logger.debug(`[SmartSuggestions] Cooldown active (${hoursSince.toFixed(1)}h < ${cooldown}h), skipping`);
                return;
            }
        }

        // 2. Preferences & Limits
        const prefs = await notificationStore.getPreferences();
        const legacySuggestionFrequency = await notificationStore.getLegacySmartSuggestionFrequency();
        if (isQuietHours(new Date(), prefs)) {
            Logger.debug('[SmartSuggestions] Quiet hours, skipping');
            return;
        }

        const lastAppOpen = await getLastAppOpenTimestamp();
        if (
            typeof lastAppOpen === 'number'
            && Date.now() - lastAppOpen < NOTIFICATION_TIMING.smartSuggestions.recentAppOpenCooldownMs
        ) {
            Logger.info('[SmartSuggestions] App opened recently, skipping', {
                minutesSinceLastOpen: Math.round((Date.now() - lastAppOpen) / 60000),
            });
            return;
        }

        // 3. Battery Check & Season Limits
        const profiles = await database.get<UserProfile>('user_profile').query().fetch();
        const profile = profiles[0];
        const batteryLevel = profile?.socialBatteryCurrent ?? null;
        const currentSeason = profile?.currentSocialSeason;
        const suggestionFrequency = resolveSuggestionFrequency(
            profile?.suggestionFrequency,
            legacySuggestionFrequency
        );
        const preferredWindows = resolvePreferredSuggestionWindows(profile);
        const currentTimingWindow = getTimingWindowForDate(new Date());
        const maxAllowed = getSmartSuggestionDailyLimit(suggestionFrequency);

        if (!isWindowWithinPreferences(currentTimingWindow, preferredWindows)) {
            Logger.info('[SmartSuggestions] Outside preferred suggestion window, skipping', {
                currentTimingWindow,
                preferredWindows,
            });
            return;
        }

        const todayStats = await notificationStore.getSmartNotificationCount();
        const today = new Date().toDateString();
        let todayCount = (todayStats?.date === today) ? todayStats.count : 0;

        // Check scheduled for today
        const scheduledStats = await notificationStore.getScheduledSmartNotifications();
        const alreadyScheduledCount = (scheduledStats?.date === today) ? scheduledStats.ids.length : 0;

        // Apply season limits
        const seasonAdjustedLimit = applySeasonLimit(maxAllowed, currentSeason);
        const remainingSlots = seasonAdjustedLimit - alreadyScheduledCount;

        if (remainingSlots <= 0) return;

        // 4. Build suggestions from the shared selector-backed surface when enabled,
        // otherwise retain the legacy notification-specific generation path.
        let suggestions: Suggestion[] = [];
        let source: 'selector' | 'legacy-generator' = 'legacy-generator';
        let selectionReason: string | undefined;

        if (isOpportunityNotificationsEnabled()) {
            const surface = await fetchSuggestionSurface(
                Math.max(2, remainingSlots),
                currentSeason,
                undefined,
                { forceSelector: true, trackAnalytics: false, respectPacing: true }
            );
            const primarySuggestion = surface.suggestions.find(suggestion =>
                surface.selectorSuggestionMetadata?.[suggestion.id]?.surfaceSlot === 'primary'
            ) || surface.suggestions[0];
            const primaryMetadata = primarySuggestion
                ? surface.selectorSuggestionMetadata?.[primarySuggestion.id]
                : undefined;

            source = 'selector';
            selectionReason = surface.selectionReason;

            if (
                primarySuggestion
                && primaryMetadata
                && primaryMetadata.compositeScore >= MIN_SELECTOR_NOTIFICATION_SCORE
                && isPushEligibleSuggestion(primarySuggestion)
            ) {
                suggestions = [primarySuggestion];
            } else {
                suggestions = [];
            }

            Logger.info('[SmartSuggestions] Selector-backed evaluation complete', {
                surfaceSource: surface.surfaceSource,
                selectionReason: surface.selectionReason,
                quietReason: surface.quietReason,
                suggestionCount: surface.suggestions.length,
                pushEligibleCount: suggestions.length,
                primaryScore: primaryMetadata?.compositeScore,
            });

            if (surface.quietReason && surface.suggestions.length === 0) {
                Logger.info('[SmartSuggestions] Selector pacing kept notifications quiet', {
                    quietReason: surface.quietReason,
                    selectionReason: surface.selectionReason,
                });
                return;
            }
        } else {
            const legacySuggestions: Suggestion[] = [];
            const friends = await database.get<Friend>('friends').query().fetch();

            // Batch fetch ALL interaction_friends
            const allInteractionFriends = await database
                .get<InteractionFriend>('interaction_friends')
                .query()
                .fetch();

            // Build friend -> interaction IDs map
            const friendInteractionIdsMap = new Map<string, string[]>();
            for (const ifr of allInteractionFriends) {
                const existing = friendInteractionIdsMap.get(ifr.friendId) || [];
                existing.push(ifr.interactionId);
                friendInteractionIdsMap.set(ifr.friendId, existing);
            }

            // Get unique interaction IDs
            const allInteractionIds = [...new Set(allInteractionFriends.map(i => i.interactionId))];

            // Batch fetch ALL completed interactions
            const allCompletedInteractions = allInteractionIds.length > 0
                ? await database.get<Interaction>('interactions')
                    .query(Q.where('id', Q.oneOf(allInteractionIds)), Q.where('status', 'completed'))
                    .fetch()
                : [];
            const completedInteractionMap = new Map(allCompletedInteractions.map(i => [i.id, i]));

            // Batch fetch ALL planned interactions for the next 7 days
            const now = Date.now();
            const plannedWeaveWindowMs = NOTIFICATION_TIMING.smartSuggestions.plannedWeaveWindowMs;
            const allPlannedInteractions = allInteractionIds.length > 0
                ? await database.get<Interaction>('interactions')
                    .query(
                        Q.where('id', Q.oneOf(allInteractionIds)),
                        Q.where('status', 'planned'),
                        Q.where('interaction_date', Q.gt(now)),
                        Q.where('interaction_date', Q.lt(now + plannedWeaveWindowMs))
                    )
                    .fetch()
                : [];

            // Build set of friend IDs that have planned weaves
            const friendsWithPlannedWeaves = new Set<string>();
            for (const ifr of allInteractionFriends) {
                if (allPlannedInteractions.some(p => p.id === ifr.interactionId)) {
                    friendsWithPlannedWeaves.add(ifr.friendId);
                }
            }

            // Process each friend using in-memory data
            for (const friend of friends) {
                const interactionIds = friendInteractionIdsMap.get(friend.id) || [];

                // Get friend's completed interactions from map
                const friendCompletedInteractions = interactionIds
                    .map(id => completedInteractionMap.get(id))
                    .filter((i): i is Interaction => !!i && i.interactionDate != null)
                    .sort((a, b) => b.interactionDate.getTime() - a.interactionDate.getTime());

                const lastInteractionDate = friendCompletedInteractions[0]?.interactionDate;
                const interactionCount = friendCompletedInteractions.length;
                const recentInteractions = friendCompletedInteractions.slice(0, 5);

                // Dedupe: cooldown for recent interactions
                if (lastInteractionDate && (Date.now() - lastInteractionDate.getTime()) < NOTIFICATION_TIMING.smartSuggestions.recentInteractionCooldownMs) {
                    continue;
                }

                // Skip friends with planned weaves in the next 7 days (using pre-computed set)
                if (friendsWithPlannedWeaves.has(friend.id)) {
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

                if (suggestion) legacySuggestions.push(suggestion);
            }

            suggestions = legacySuggestions;
        }

        const recentlySurfacedSuggestionIds = await getRecentlySurfacedFocusSuggestionIds(
            NOTIFICATION_TIMING.smartSuggestions.recentFocusSuggestionSurfaceCooldownMs
        );

        if (recentlySurfacedSuggestionIds.size > 0) {
            const beforeDedupeCount = suggestions.length;
            suggestions = suggestions.filter(
                suggestion => !recentlySurfacedSuggestionIds.has(suggestion.id)
            );

            if (beforeDedupeCount !== suggestions.length) {
                Logger.info('[SmartSuggestions] Skipping suggestions recently surfaced in Focus', {
                    source,
                    filteredCount: beforeDedupeCount - suggestions.length,
                    remainingCount: suggestions.length,
                });
            }
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
        if (toSchedule.length === 0) {
            Logger.info('[SmartSuggestions] No eligible suggestions to schedule', {
                source,
                selectionReason,
                candidateCount: suggestions.length,
                eligibleCount: eligible.length,
            });
            return;
        }

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
                delayMinutes: delay,
                source,
                selectionReason,
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
        if (id !== ID_PREFIX) {
            await Notifications.cancelScheduledNotificationAsync(id);
            return;
        }

        const all = await Notifications.getAllScheduledNotificationsAsync();
        for (const n of all) {
            if (n.identifier.startsWith(ID_PREFIX)) {
                await Notifications.cancelScheduledNotificationAsync(n.identifier);
            }
        }
    },

    handleTap: (data, router) => {
        if (data.friendId) {
            router.push({
                pathname: '/friend-profile',
                params: { friendId: data.friendId },
            });
            notificationAnalytics.trackActionCompleted('friend-suggestion', 'view_profile');
        } else {
            router.replace('/dashboard');
        }
    }
};
