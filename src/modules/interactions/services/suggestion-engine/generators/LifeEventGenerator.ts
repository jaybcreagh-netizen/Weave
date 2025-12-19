import { Suggestion, Archetype } from '@/shared/types/common';
import { SuggestionContext, SuggestionGenerator } from '../types';
import { database } from '@/db';
import LifeEvent, { LifeEventType } from '@/db/models/LifeEvent';
import { differenceInDays, startOfDay } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { parseFlexibleDate } from '@/shared/utils/date-utils';
import { getDaysText } from '../utils';
import Logger from '@/shared/utils/Logger';

import {
    getArchetypeCelebrationSuggestion
} from '@/shared/constants/archetype-content';

interface LifeEventInfo {
    id: string;
    type: 'birthday' | 'anniversary' | LifeEventType;
    daysUntil: number;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    title?: string;
}

export class LifeEventGenerator implements SuggestionGenerator {
    name = 'LifeEventGenerator';
    priority = 10; // Priorities 2 (urgent) and 5 (upcoming)

    async generate(context: SuggestionContext): Promise<Suggestion | null> {
        const { friend, now } = context;
        const lifeEvent = await this.checkUpcomingLifeEvent(friend, now);

        if (!lifeEvent) return null;

        // PRIORITY 2: Urgent Life Events (Today or Tomorrow)
        if (lifeEvent.daysUntil <= 1) {
            return this.createSuggestion(lifeEvent, friend, 'urgent');
        }

        // PRIORITY 5: Upcoming life event
        // (birthday within 7 days, anniversary within 14 days)
        return this.createSuggestion(lifeEvent, friend, 'upcoming');
    }

    private createSuggestion(
        lifeEvent: LifeEventInfo,
        friend: SuggestionContext['friend'],
        mode: 'urgent' | 'upcoming'
    ): Suggestion {
        const eventIconMap: Record<string, string> = {
            birthday: 'Gift',
            anniversary: 'Heart',
            new_job: 'Briefcase',
            moving: 'Home',
            graduation: 'GraduationCap',
            health_event: 'Activity',
            celebration: 'PartyPopper',
            loss: 'HeartCrack',
            wedding: 'Heart',
            baby: 'Egg',
        };

        const eventLabelMap: Record<string, string> = {
            birthday: 'birthday',
            anniversary: 'anniversary',
            new_job: 'new job',
            moving: 'move',
            graduation: 'graduation',
            health_event: 'health event',
            celebration: 'celebration',
            loss: 'loss',
            wedding: 'wedding',
            baby: 'baby',
        };

        const eventIcon = eventIconMap[lifeEvent.type] || 'Calendar';
        const eventLabel = lifeEvent.title || eventLabelMap[lifeEvent.type] || lifeEvent.type;

        const subtitle = (lifeEvent.type === 'birthday' || lifeEvent.type === 'anniversary')
            ? getArchetypeCelebrationSuggestion(friend.archetype)
            : this.getLifeEventSuggestion(lifeEvent.type, friend.archetype, lifeEvent);

        const title = lifeEvent.daysUntil < 0
            ? `Check in on ${friend.name}'s ${eventLabel}`
            : `${friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`;

        const actionLabel = lifeEvent.daysUntil < 0 ? 'Reach Out' : 'Plan';

        const urgency = mode === 'urgent' ? 'critical' : (lifeEvent.daysUntil <= 1 ? 'high' : 'medium');

        // Override urgency if not explicitly set to standard mapping by mode, 
        // although redundant given the call sites, it's safer.

        return {
            id: `life-event-${lifeEvent.id}`,
            friendId: friend.id,
            friendName: friend.name,
            urgency,
            category: 'life-event',
            title,
            subtitle,
            actionLabel,
            icon: eventIcon,
            action: {
                type: lifeEvent.daysUntil < 0 ? 'log' : 'plan',
                prefilledCategory: 'celebration' as any,
            },
            dismissible: true,
            createdAt: new Date(),
            type: 'connect',
        };
    }

    private getLifeEventSuggestion(eventType: LifeEventType | 'birthday' | 'anniversary', archetype: string, lifeEvent: LifeEventInfo): string {
        if (lifeEvent.daysUntil < 0) {
            const followUps: Record<string, string> = {
                wedding: 'Check how married life is going',
                baby: 'See how they\'re adjusting',
                new_job: 'Ask how the new role is',
                moving: 'See how they\'re settling in',
                loss: 'Check how they\'re doing',
                health_event: 'Check on their recovery',
                graduation: 'Celebrate their achievement',
            };
            return followUps[eventType] || 'Check in with them';
        }

        if (eventType === 'birthday' || eventType === 'anniversary') {
            return getArchetypeCelebrationSuggestion(archetype as Archetype);
        }

        const suggestions: Record<string, string> = {
            wedding: 'Offer help or congratulations',
            baby: 'Offer support or a gift',
            new_job: 'Send congrats',
            moving: 'Offer help with the move',
            loss: 'Reach out with support',
            health_event: 'Offer support',
            graduation: 'Congratulate them',
            celebration: 'Celebrate this milestone',
        };
        return suggestions[eventType] || 'Reach out';
    }

    private async checkUpcomingLifeEvent(friend: SuggestionContext['friend'], now: Date): Promise<LifeEventInfo | null> {
        const today = startOfDay(now);

        try {
            const activeLifeEvents = await database
                .get<LifeEvent>('life_events')
                .query(
                    Q.where('friend_id', friend.id),
                    Q.or(
                        Q.and(
                            Q.where('event_date', Q.gte(today.getTime())),
                            Q.where('event_date', Q.lte(today.getTime() + 30 * 24 * 60 * 60 * 1000))
                        ),
                        Q.and(
                            Q.where('event_date', Q.gte(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
                            Q.where('event_date', Q.lt(today.getTime()))
                        )
                    )
                )
                .fetch();

            const filteredEvents = activeLifeEvents.filter(event => {
                if (event.eventType === 'anniversary') {
                    return friend.relationshipType?.toLowerCase().includes('partner');
                }
                return true;
            });

            const sortedEvents = filteredEvents.sort((a, b) => {
                const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                const aScore = importanceOrder[a.importance];
                const bScore = importanceOrder[b.importance];
                if (aScore !== bScore) return bScore - aScore;
                return Math.abs(differenceInDays(startOfDay(a.eventDate), today)) - Math.abs(differenceInDays(startOfDay(b.eventDate), today));
            });

            if (sortedEvents.length > 0) {
                const topEvent = sortedEvents[0];
                const daysUntil = differenceInDays(startOfDay(topEvent.eventDate), today);

                return {
                    id: topEvent.id,
                    type: topEvent.eventType,
                    daysUntil,
                    importance: topEvent.importance,
                    title: topEvent.title,
                };
            }
        } catch (error) {
            Logger.error('Error checking life events', error);
        }

        // Fallback: Birthday
        if (friend.birthday) {
            const dateParts = parseFlexibleDate(friend.birthday);
            if (dateParts && this.isValidDate(dateParts)) {
                const { month, day } = dateParts;
                const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
                birthdayThisYear.setHours(0, 0, 0, 0);

                if (birthdayThisYear < today) {
                    birthdayThisYear.setFullYear(today.getFullYear() + 1);
                }

                const daysUntil = differenceInDays(birthdayThisYear, today);
                if (daysUntil >= 0 && daysUntil <= 7) {
                    return { id: `birthday - ${friend.id} `, type: 'birthday', daysUntil, importance: 'high' };
                }
            }
        }

        // Fallback: Anniversary
        if (friend.anniversary && friend.relationshipType?.toLowerCase().includes('partner')) {
            const dateParts = parseFlexibleDate(friend.anniversary);
            if (dateParts && this.isValidDate(dateParts)) {
                const { month, day } = dateParts;
                const anniversaryThisYear = new Date(today.getFullYear(), month - 1, day);
                anniversaryThisYear.setHours(0, 0, 0, 0);

                if (anniversaryThisYear < today) {
                    anniversaryThisYear.setFullYear(today.getFullYear() + 1);
                }

                const daysUntil = differenceInDays(anniversaryThisYear, today);
                if (daysUntil >= 0 && daysUntil <= 14) {
                    return { id: `anniversary - ${friend.id} `, type: 'anniversary', daysUntil, importance: 'medium' };
                }
            }
        }

        return null;
    }

    private isValidDate(parts: { month: number; day: number }): boolean {
        return parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31;
    }
}
