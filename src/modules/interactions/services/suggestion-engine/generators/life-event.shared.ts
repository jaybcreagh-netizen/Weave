import { Q } from '@nozbe/watermelondb';
import { differenceInDays, startOfDay } from 'date-fns';
import { database } from '@/db';
import LifeEvent, { type LifeEventType } from '@/db/models/LifeEvent';
import type { Suggestion, Archetype } from '@/shared/types/common';
import { parseFlexibleDate } from '@/shared/utils/date-utils';
import Logger from '@/shared/utils/Logger';
import { getArchetypeCelebrationSuggestion } from '@/shared/constants/archetype-content';
import { getDaysText } from '../utils';
import type { SuggestionContext } from '../types';
import type { Opportunity } from '../../opportunity-system/types';

export interface LifeEventInfo {
    id: string;
    type: 'birthday' | 'anniversary' | LifeEventType;
    daysUntil: number;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    title?: string;
}

const EVENT_ICON_MAP: Record<string, string> = {
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

const EVENT_LABEL_MAP: Record<string, string> = {
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

function isValidDate(parts: { month: number; day: number }): boolean {
    return parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31;
}

function getLifeEventSuggestion(
    eventType: LifeEventType | 'birthday' | 'anniversary',
    archetype: string,
    lifeEvent: LifeEventInfo
): string {
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

export async function findUpcomingLifeEvent(
    friend: SuggestionContext['friend'],
    now: Date
): Promise<LifeEventInfo | null> {
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
            return Math.abs(differenceInDays(startOfDay(a.eventDate), today))
                - Math.abs(differenceInDays(startOfDay(b.eventDate), today));
        });

        if (sortedEvents.length > 0) {
            const topEvent = sortedEvents[0];
            return {
                id: topEvent.id,
                type: topEvent.eventType,
                daysUntil: differenceInDays(startOfDay(topEvent.eventDate), today),
                importance: topEvent.importance,
                title: topEvent.title,
            };
        }
    } catch (error) {
        Logger.error('Error checking life events', error);
    }

    if (friend.birthday) {
        const dateParts = parseFlexibleDate(friend.birthday);
        if (dateParts && isValidDate(dateParts)) {
            const birthdayThisYear = new Date(today.getFullYear(), dateParts.month - 1, dateParts.day);
            birthdayThisYear.setHours(0, 0, 0, 0);
            if (birthdayThisYear < today) {
                birthdayThisYear.setFullYear(today.getFullYear() + 1);
            }
            const daysUntil = differenceInDays(startOfDay(birthdayThisYear), startOfDay(today));
            if (daysUntil >= 0 && daysUntil <= 7) {
                return { id: `birthday-${friend.id}`, type: 'birthday', daysUntil, importance: 'high' };
            }
        }
    }

    if (friend.anniversary && friend.relationshipType?.toLowerCase().includes('partner')) {
        const dateParts = parseFlexibleDate(friend.anniversary);
        if (dateParts && isValidDate(dateParts)) {
            const anniversaryThisYear = new Date(today.getFullYear(), dateParts.month - 1, dateParts.day);
            anniversaryThisYear.setHours(0, 0, 0, 0);
            if (anniversaryThisYear < today) {
                anniversaryThisYear.setFullYear(today.getFullYear() + 1);
            }
            const daysUntil = differenceInDays(startOfDay(anniversaryThisYear), startOfDay(today));
            if (daysUntil >= 0 && daysUntil <= 14) {
                return { id: `anniversary-${friend.id}`, type: 'anniversary', daysUntil, importance: 'medium' };
            }
        }
    }

    return null;
}

export function buildLifeEventSuggestion(
    context: SuggestionContext,
    lifeEvent: LifeEventInfo
): Suggestion {
    const eventIcon = EVENT_ICON_MAP[lifeEvent.type] || 'Calendar';
    const eventLabel = lifeEvent.title || EVENT_LABEL_MAP[lifeEvent.type] || lifeEvent.type;
    const subtitle = (lifeEvent.type === 'birthday' || lifeEvent.type === 'anniversary')
        ? getArchetypeCelebrationSuggestion(context.friend.archetype)
        : getLifeEventSuggestion(lifeEvent.type, context.friend.archetype, lifeEvent);
    const title = lifeEvent.daysUntil < 0
        ? `Check in on ${context.friend.name}'s ${eventLabel}`
        : `${context.friend.name}'s ${eventLabel} ${getDaysText(lifeEvent.daysUntil)}`;
    const actionLabel = lifeEvent.daysUntil < 0 ? 'Reach Out' : 'Plan';
    const urgency = lifeEvent.daysUntil <= 1
        ? (lifeEvent.daysUntil <= 1 ? 'critical' : 'high')
        : 'medium';

    return {
        id: `life-event-${lifeEvent.id}`,
        friendId: context.friend.id,
        friendName: context.friend.name,
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
        createdAt: context.now,
        type: 'connect',
    };
}

export function buildLifeEventOpportunity(
    context: SuggestionContext,
    lifeEvent: LifeEventInfo
): Opportunity {
    const suggestion = buildLifeEventSuggestion(context, lifeEvent);

    return {
        id: suggestion.id,
        friendId: context.friend.id,
        friendName: context.friend.name,
        friendTier: context.friend.dunbarTier,
        category: 'life-event',
        generatorSource: 'life-event-generator',
        urgency: lifeEvent.daysUntil <= 1 ? 92 : 70,
        confidence: 0.9,
        effortLevel: lifeEvent.daysUntil < 0 ? 'minimal' : 'moderate',
        estimatedDurationMinutes: lifeEvent.daysUntil < 0 ? 10 : 30,
        explanation: {
            whyNow: suggestion.title,
            whyThisFriend: `${context.friend.name} has a meaningful date or milestone that needs attention.`,
            whyThisAction: lifeEvent.daysUntil < 0
                ? 'A quick check-in is the most appropriate next step.'
                : 'Planning ahead will help you show up well for this moment.',
        },
        timeRelevance: {
            bestWindow: lifeEvent.daysUntil <= 1 ? 'afternoon' : 'morning',
            deadlineAt: lifeEvent.daysUntil >= 0
                ? startOfDay(new Date(context.now.getTime() + lifeEvent.daysUntil * 24 * 60 * 60 * 1000)).getTime()
                : undefined,
        },
        copyContext: {
            recentInteractionCategory: 'celebration',
        },
        createdAt: context.now.getTime(),
    };
}
