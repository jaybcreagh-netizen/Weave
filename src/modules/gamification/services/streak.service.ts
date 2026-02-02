/**
 * Streak Service
 * 
 * Calculates and tracks weekly activity streaks for gamification.
 * A streak is maintained if the user logs at least 1 weave per week.
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval } from 'date-fns';

export interface StreakData {
    /** Current consecutive weeks with activity */
    currentStreak: number;
    /** Weaves logged in the current week */
    weavesThisWeek: number;
    /** Weekly goal (default 5) */
    weeklyGoal: number;
    /** Whether the current week has at least 1 weave (streak maintained) */
    isStreakActive: boolean;
    /** Last week the user was active */
    lastActiveWeek: Date | null;
}

const DEFAULT_WEEKLY_GOAL = 5;

/**
 * Get all streak-related data
 */
export async function getStreakData(): Promise<StreakData> {
    const now = new Date();

    // Fetch all completed interactions from the last 52 weeks (1 year max)
    const oneYearAgo = subWeeks(now, 52);

    const interactions = await database.get<Interaction>('interactions')
        .query(
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(oneYearAgo.getTime())),
            Q.sortBy('interaction_date', Q.desc)
        )
        .fetch();

    // Calculate weeks with activity
    const weeksWithActivity = new Map<string, number>();

    for (const interaction of interactions) {
        const weekStart = startOfWeek(interaction.interactionDate, { weekStartsOn: 0 });
        const weekKey = weekStart.toISOString();
        weeksWithActivity.set(weekKey, (weeksWithActivity.get(weekKey) || 0) + 1);
    }

    // Count current week weaves
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });

    const weavesThisWeek = interactions.filter(i =>
        isWithinInterval(i.interactionDate, { start: currentWeekStart, end: currentWeekEnd })
    ).length;

    // Calculate streak by walking backwards from current week
    let currentStreak = 0;
    let checkWeek = currentWeekStart;
    let lastActiveWeek: Date | null = null;

    // If current week has activity, it counts toward streak
    if (weeksWithActivity.has(checkWeek.toISOString())) {
        currentStreak = 1;
        lastActiveWeek = checkWeek;
        checkWeek = subWeeks(checkWeek, 1);
    } else {
        // Current week has no activity yet, check if last week had activity
        // (streak is still "alive" if we're early in the week)
        checkWeek = subWeeks(checkWeek, 1);
    }

    // Walk backwards through weeks
    while (weeksWithActivity.has(checkWeek.toISOString())) {
        currentStreak++;
        if (!lastActiveWeek) {
            lastActiveWeek = checkWeek;
        }
        checkWeek = subWeeks(checkWeek, 1);
    }

    return {
        currentStreak,
        weavesThisWeek,
        weeklyGoal: DEFAULT_WEEKLY_GOAL,
        isStreakActive: weavesThisWeek > 0 || currentStreak > 0,
        lastActiveWeek,
    };
}

/**
 * Calculate just the streak number (lighter version for header display)
 */
export async function getCurrentStreak(): Promise<number> {
    const data = await getStreakData();
    return data.currentStreak;
}

/**
 * Calculate just this week's progress
 */
export async function getWeeklyProgress(): Promise<{ count: number; goal: number }> {
    const data = await getStreakData();
    return {
        count: data.weavesThisWeek,
        goal: data.weeklyGoal,
    };
}

export const StreakService = {
    getStreakData,
    getCurrentStreak,
    getWeeklyProgress,
};
