import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import LifeEvent from '@/db/models/LifeEvent';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { fetchSuggestions } from '@/modules/interactions/services/suggestion-provider.service';
import type { SocialSeason } from '@/db/models/UserProfile';
import { differenceInDays, isSameDay, startOfDay } from 'date-fns';
import { HOLIDAYS, DYNAMIC_DATE_CALCULATORS, Holiday } from './calendar-season/holidays';

export interface UpcomingDate {
    friend?: FriendModel;
    type: 'birthday' | 'anniversary' | 'life_event' | 'holiday';
    daysUntil: number;
    title?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    date?: Date;
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
                    daysUntil: differenceInDays(startOfDay(event.eventDate), startOfDay(today)),
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
                    const daysUntil = differenceInDays(startOfDay(birthdayThisYear), startOfDay(today));
                    if (daysUntil >= 0 && daysUntil <= 7) {
                        events.push({ friend, type: 'birthday', daysUntil });
                    }
                }
            } catch (e) {
                // ignore
            }
        });

        // 3. Holidays
        const upcomingHolidays = this.getUpcomingHolidays(today, thirtyDaysFromNow, allFriends);
        events.push(...upcomingHolidays);

        events.sort((a, b) => a.daysUntil - b.daysUntil);
        return events;
    },

    /**
     * Get upcoming holidays
     */
    getUpcomingHolidays(today: Date, endDate: Date, friends: FriendModel[]): UpcomingDate[] {
        const events: UpcomingDate[] = [];
        const currentYear = today.getFullYear();

        // Check current year and next year to cover year boundaries
        const yearsToCheck = [currentYear, currentYear + 1];

        // Helper to get date from holiday
        const getHolidayDate = (holiday: Holiday, year: number): Date | null => {
            try {
                if (holiday.date === 'dynamic' && holiday.dynamicDateKey) {
                    const calculator = DYNAMIC_DATE_CALCULATORS[holiday.dynamicDateKey];
                    return calculator ? calculator(year) : null;
                } else if (holiday.date !== 'dynamic') {
                    const [month, day] = holiday.date.split('-').map(n => parseInt(n, 10));
                    return new Date(year, month - 1, day);
                }
            } catch (e) {
                console.warn(`Error calculating date for holiday ${holiday.id}`, e);
            }
            return null;
        };

        HOLIDAYS.forEach(holiday => {
            // Skip disabled holidays (unless we want to support user preferences later)
            if (!holiday.defaultEnabled) return;

            yearsToCheck.forEach(year => {
                const date = getHolidayDate(holiday, year);
                if (!date) return;

                // Normalize time
                date.setHours(0, 0, 0, 0);

                // Check if within window
                if (date >= today && date <= endDate) {
                    const daysUntil = differenceInDays(startOfDay(date), startOfDay(today));

                    // Special logic for specific holidays
                    if (holiday.id === 'valentines-day') {
                        // Partner logic: find a partner
                        const partner = friends.find(f =>
                            f.relationshipType?.toLowerCase() === 'partner'
                        );

                        if (partner) {
                            events.push({
                                friend: partner,
                                type: 'holiday',
                                daysUntil,
                                title: holiday.name,
                                importance: 'high',
                                date
                            });
                            return; // Don't add generic event if we found a partner
                        }
                    }

                    // Generic holiday event
                    events.push({
                        type: 'holiday',
                        daysUntil,
                        title: holiday.name,
                        importance: holiday.category === 'major' ? 'high' : 'medium',
                        date
                    });
                }
            });
        });

        return events;
    },

    /**
     * Get suggestions with optional season-aware filtering
     */
    async getSuggestions(limit: number = 10, season?: SocialSeason | null): Promise<Suggestion[]> {
        const suggestions = await fetchSuggestions(limit, season);
        return this.enrichWithContext(suggestions);
    },

    /**
     * Enrich suggestions with LLM-generated context snippets
     */
    async enrichWithContext(suggestions: Suggestion[]): Promise<Suggestion[]> {
        // Return early if no suggestions
        if (suggestions.length === 0) return [];

        // We'll process in parallel but handle errors gracefully
        const enriched = await Promise.all(suggestions.map(async (suggestion) => {
            try {
                // Only enrich friend-based suggestions
                if (!suggestion.friendId) return suggestion;

                // 1. Fetch recent signals and threads for this friend
                // We use raw SQL or watermelon queries here.
                // For MVP, let's keep it lightweight. 
                // Checks for active threads or recent negative signals.

                // Note: We need to import these models/tables. 
                // If tables don't exist yet (Phase 1 pending?), we skip.
                // Assuming they exist per previous list_dir checks (ConversationThread.ts exists).

                const threads = await database.get('conversation_threads')
                    .query(
                        Q.where('friend_id', suggestion.friendId),
                        Q.where('status', 'active'),
                        Q.sortBy('last_mentioned', Q.desc),
                        Q.take(1)
                    ).fetch();

                if (threads.length > 0) {
                    const thread = threads[0] as any; // Cast to avoid strict typing issues if model generic
                    // Simple rule-based enrichment for now to save tokens/latency
                    // "Sarah mentioned [Topic] recently."
                    return {
                        ...suggestion,
                        contextSnippet: `${suggestion.friendName || 'They'} mentioned ${thread.topic} recently.`,
                        aiEnriched: true
                    };
                }

                return suggestion;

            } catch (e) {
                // Fail silent, return original
                return suggestion;
            }
        }));

        return enriched;
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
