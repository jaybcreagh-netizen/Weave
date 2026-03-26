import { Suggestion } from '@/shared/types/common';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import type { Opportunity } from '../../opportunity-system/types';

/**
 * WeeklyReflectionGenerator
 * Generates the "Sunday Reflection" system suggestion.
 * This runs once per session/refresh, not per friend.
 */
export class WeeklyReflectionGenerator {
    static buildOpportunity(now: Date): Opportunity | null {
        if (now.getDay() !== 0) {
            return null;
        }

        return {
            id: 'weekly-reflection-sunday',
            category: 'daily-reflect',
            generatorSource: 'weekly-reflection-generator',
            urgency: 78,
            confidence: 0.95,
            effortLevel: 'minimal',
            estimatedDurationMinutes: 10,
            explanation: {
                whyNow: 'Take a moment to look back on your week.',
                whyThisFriend: 'A weekly reflection helps you notice what is working across your relationships.',
                whyThisAction: 'A short reflection can turn the week into something you learn from.',
            },
            timeRelevance: {
                bestWindow: 'evening',
                expiresAt: new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    23,
                    59,
                    59,
                    999
                ).getTime(),
            },
            createdAt: now.getTime(),
        };
    }

    static async generateOpportunity(now: Date = new Date()): Promise<Opportunity | null> {
        const opportunity = this.buildOpportunity(now);
        if (!opportunity) {
            return null;
        }

        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const weeklyReflectionsCount = await database.get('weekly_reflections').query(
            Q.where('created_at', Q.gte(startOfToday.getTime()))
        ).fetchCount();

        return weeklyReflectionsCount === 0 ? opportunity : null;
    }

    static async generate(): Promise<Suggestion | null> {
        const today = new Date();
        const opportunity = await this.generateOpportunity(today);
        if (!opportunity) {
            return null;
        }

        return {
            id: opportunity.id,
            friendId: '',
            friendName: 'Yourself',
            urgency: 'high',
            category: 'daily-reflect',
            title: 'Sunday Reflection',
            subtitle: opportunity.explanation.whyNow,
            actionLabel: 'Reflect',
            icon: 'BookOpen',
            action: { type: 'reflect' },
            dismissible: true,
            createdAt: today,
            expiresAt: opportunity.timeRelevance.expiresAt
                ? new Date(opportunity.timeRelevance.expiresAt)
                : undefined,
            type: 'reflect'
        };
    }
}
