import { Suggestion } from '@/shared/types/common';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

/**
 * WeeklyReflectionGenerator
 * Generates the "Sunday Reflection" system suggestion.
 * This runs once per session/refresh, not per friend.
 */
export class WeeklyReflectionGenerator {
    static async generate(): Promise<Suggestion | null> {
        const today = new Date();
        if (today.getDay() === 0) { // Sunday
            const startOfToday = new Date(today);
            startOfToday.setHours(0, 0, 0, 0);

            const weeklyReflectionsCount = await database.get('weekly_reflections').query(
                Q.where('created_at', Q.gte(startOfToday.getTime()))
            ).fetchCount();

            if (weeklyReflectionsCount === 0) {
                return {
                    id: 'weekly-reflection-sunday',
                    friendId: '',
                    friendName: 'Yourself',
                    urgency: 'high',
                    category: 'insight',
                    title: 'Sunday Reflection',
                    subtitle: 'Take a moment to look back on your week.',
                    actionLabel: 'Reflect',
                    icon: 'BookOpen',
                    action: { type: 'reflect' },
                    dismissible: true,
                    createdAt: new Date(),
                    type: 'reflect'
                };
            }
        }
        return null;
    }
}
