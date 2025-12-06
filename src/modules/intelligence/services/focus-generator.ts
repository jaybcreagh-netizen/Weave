import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import LifeEvent from '@/db/models/LifeEvent';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { fetchSuggestions } from '@/modules/interactions/services/suggestion-provider.service'; // Ensure this path is correct
import { differenceInDays, isSameDay } from 'date-fns';

export interface UpcomingDate {
    friend: FriendModel;
    type: 'birthday' | 'anniversary' | 'life_event';
    daysUntil: number;
    title?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
}

export interface FocusData {
    plans: Interaction[];
    suggestions: Suggestion[];
    upcomingDates: UpcomingDate[];
    pendingConfirmations: Interaction[];
}

export const FocusGenerator = {
    /**
     * Get interactions that require attention (today's plans or pending confirmations)
     */
    async getImportantPlans(): Promise<{ plans: Interaction[]; pending: Interaction[] }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const interactions = await database.get<Interaction>('interactions').query().fetch();

        const filtered = interactions
            .filter((i: Interaction) => {
                const iDate = new Date(i.interactionDate);
                iDate.setHours(0, 0, 0, 0);

                // Filter out plans further than tomorrow
                if (iDate > tomorrow) return false;

                const isToday = iDate.getTime() === today.getTime();
                // Today's plans: show unless cancelled
                if (isToday && i.status !== 'cancelled') return true;
                // Past plans: show if pending confirmation (not completed/cancelled) for last 7 days
                if (i.status === 'completed' || i.status === 'cancelled') return false;
                return iDate >= sevenDaysAgo;
            })
            .sort((a, b) => new Date(a.interactionDate).getTime() - new Date(b.interactionDate).getTime());

        const todaysPlans = filtered.filter(p => isSameDay(new Date(p.interactionDate), today));
        // Pending includes past unconfirmed AND today's unconfirmed plans?
        // Widget logic: "visiblePendingPlans" included today's plans too.
        // We separate them for Digest purposes, but return all for widget compatibility.

        return {
            plans: todaysPlans,
            pending: filtered,
        };
    },

    /**
     * Get upcoming birthdays and life events
     */
    async getUpcomingDates(friends?: FriendModel[]): Promise<UpcomingDate[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const events: UpcomingDate[] = [];

        const allFriends = friends || await database.get<FriendModel>('friends').query().fetch();

        // 1. Life Events
        const lifeEvents = await database
            .get<LifeEvent>('life_events')
            .query(
                Q.where('event_date', Q.gte(today.getTime())),
                Q.where('event_date', Q.lte(thirtyDaysFromNow.getTime()))
            )
            .fetch();

        lifeEvents.forEach(event => {
            const friend = allFriends.find(f => f.id === event.friendId);
            if (friend) {
                events.push({
                    friend,
                    type: 'life_event',
                    daysUntil: differenceInDays(event.eventDate, today),
                    title: event.title,
                    importance: event.importance,
                });
            }
        });

        // 2. Birthdays
        allFriends.forEach(friend => {
            try {
                if (friend.birthday) {
                    const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));
                    const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
                    birthdayThisYear.setHours(0, 0, 0, 0);
                    if (birthdayThisYear < today) birthdayThisYear.setFullYear(today.getFullYear() + 1);
                    const daysUntil = differenceInDays(birthdayThisYear, today);
                    if (daysUntil >= 0 && daysUntil <= 7) {
                        events.push({ friend, type: 'birthday', daysUntil });
                    }
                }
            } catch (e) {
                // ignore
            }
        });

        events.sort((a, b) => a.daysUntil - b.daysUntil);
        return events;
    },

    /**
     * Get suggestions
     */
    async getSuggestions(limit: number = 3): Promise<Suggestion[]> {
        return fetchSuggestions(limit);
    },

    /**
     * Generate full focus data
     */
    async generateFocusData(): Promise<FocusData> {
        const { plans, pending } = await this.getImportantPlans();
        const upcomingDates = await this.getUpcomingDates();
        const suggestions = await this.getSuggestions();

        return {
            plans, // Today's plans
            pendingConfirmations: pending, // Includes today's plans + past pending
            upcomingDates,
            suggestions,
        };
    }
};
