import { differenceInDays, format, startOfDay } from 'date-fns';
import { parseFlexibleDate } from '@/shared/utils/date-utils';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from './orchestrator.service';
import { type Friend } from '@/shared/types/legacy-types';
import { HydratedFriend } from '@/types/hydrated';

export interface StatusLine {
  text: string;
  subtext?: string;
  icon?: string;
  variant?: 'default' | 'accent' | 'warning' | 'success';
}

// Life event emoji mapping
const LIFE_EVENT_ICONS: Record<string, string> = {
  birthday: 'Cake',
  anniversary: 'Heart',
  new_job: 'Briefcase',
  moving: 'Package',
  wedding: 'Church',
  baby: 'Baby',
  loss: 'Feather',
  health_event: 'Hospital',
  graduation: 'GraduationCap',
  celebration: 'PartyPopper',
  other: 'Sparkles',
};

// Actionable nudges based on relationship health state
const MOMENTUM_NUDGES = ['Thriving', 'Going strong', 'On a roll'];
const CONSISTENT_NUDGES = ['Well nurtured', 'Steady bond', 'Keep it up'];

function getRandomNudge(nudges: string[]): string {
  return nudges[Math.floor(Math.random() * nudges.length)];
}

// Helper: Short relative time
function getShortRelativeTime(date: Date): string {
  const now = new Date();
  // Ensure we compare start of days for accurate "days ago"
  const startNow = startOfDay(now);
  const startDate = startOfDay(date);
  const days = Math.abs(differenceInDays(startNow, startDate));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 21) return '2 weeks ago';
  if (days < 28) return '3 weeks ago';
  if (days < 60) return '1 month ago';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * PRIORITY 1: Check for urgent life events
 */
async function checkLifeEventStatus(friend: HydratedFriend | Friend): Promise<StatusLine | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Check database life events
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

    const sortedEvents = activeLifeEvents.sort((a, b) => {
      // Sort logic...
      const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = importanceOrder[a.importance];
      const bScore = importanceOrder[b.importance];
      if (aScore !== bScore) return bScore - aScore;
      return Math.abs(differenceInDays(a.eventDate, today)) - Math.abs(differenceInDays(b.eventDate, today));
    });

    if (sortedEvents.length > 0) {
      const topEvent = sortedEvents[0];
      const daysUntil = differenceInDays(startOfDay(topEvent.eventDate), startOfDay(today));
      const icon = LIFE_EVENT_ICONS[topEvent.eventType] || 'Sparkles';
      const title = topEvent.title || topEvent.eventType;

      if (daysUntil === 0) return { text: `${title} is today!`, icon, variant: 'accent' };
      if (daysUntil === 1) return { text: `${title} is tomorrow`, icon, variant: 'accent' };
      if (daysUntil > 1 && daysUntil <= 30) return { text: `${title} in ${daysUntil} days`, icon, variant: 'default' };
      if (daysUntil < 0 && daysUntil >= -7) return { text: `${title} was ${Math.abs(daysUntil)} days ago`, icon, variant: 'accent' };
    }

    // Check birthday
    if (friend.birthday) {
      const dateParts = parseFlexibleDate(friend.birthday);
      if (dateParts && dateParts.month >= 1 && dateParts.month <= 12 && dateParts.day >= 1 && dateParts.day <= 31) {
        const birthdayThisYear = new Date(today.getFullYear(), dateParts.month - 1, dateParts.day);
        birthdayThisYear.setHours(0, 0, 0, 0);
        if (birthdayThisYear < today) birthdayThisYear.setFullYear(today.getFullYear() + 1);

        const daysUntil = differenceInDays(startOfDay(birthdayThisYear), startOfDay(today));
        if (daysUntil >= 0 && daysUntil <= 7) {
          if (daysUntil === 0) return { text: 'Birthday is today!', icon: 'Cake', variant: 'accent' };
          if (daysUntil === 1) return { text: 'Birthday is tomorrow', icon: 'Cake', variant: 'accent' };
          return { text: `Birthday in ${daysUntil} days`, icon: 'Cake', variant: 'default' };
        }
      }
    }

    // Check anniversary
    if (friend.anniversary) {
      const dateParts = parseFlexibleDate(friend.anniversary);
      if (dateParts && dateParts.month >= 1 && dateParts.month <= 12 && dateParts.day >= 1 && dateParts.day <= 31) {
        const anniversaryThisYear = new Date(today.getFullYear(), dateParts.month - 1, dateParts.day);
        anniversaryThisYear.setHours(0, 0, 0, 0);
        if (anniversaryThisYear < today) anniversaryThisYear.setFullYear(today.getFullYear() + 1);

        const daysUntil = differenceInDays(startOfDay(anniversaryThisYear), startOfDay(today));
        if (daysUntil >= 0 && daysUntil <= 7) {
          if (daysUntil === 0) return { text: 'Anniversary today!', icon: 'Heart', variant: 'accent' };
          if (daysUntil === 1) return { text: 'Anniversary tomorrow', icon: 'Heart', variant: 'accent' };
          return { text: `Anniversary in ${daysUntil} days`, icon: 'Heart', variant: 'default' };
        }
      }
    }
  } catch (error) {
    console.error('Error checking life events:', error);
  }

  return null;
}

/**
 * Generate specific, data-first insights for healthy relationships
 */
function generateHealthyRelationshipInsight(
  friend: HydratedFriend | Friend,
  recentInteractions: Interaction[],
  recentCount: number
): StatusLine {
  if (recentInteractions.length === 0) return { text: 'Time to reconnect', variant: 'default' };

  const lastDate = recentInteractions[0].interactionDate;
  const timeStr = getShortRelativeTime(lastDate);
  // 1. High momentum (e.g. 4+ in last month)
  if (recentCount >= 4) {
    const nudge = getRandomNudge(MOMENTUM_NUDGES);
    return {
      text: `${recentCount} weaves in 30 days`,
      subtext: nudge,
      icon: 'Zap',
      variant: 'accent'
    };
  }

  // 2. Consistent
  const nudge = getRandomNudge(CONSISTENT_NUDGES);
  return {
    text: `${timeStr}`,
    subtext: nudge,
    icon: 'Sprout',
    variant: 'success'
  };
}

/**
 * PRIORITY 2: Connection health & history
 */
async function checkConnectionHealth(friend: HydratedFriend | Friend): Promise<StatusLine | null> {
  const weaveScore = calculateCurrentScore(friend);

  try {
    // Get recent interactions (last 60 days)
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const recentInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(sixtyDaysAgo)),
        Q.sortBy('interaction_date', Q.desc)
      )
      .fetch();

    const friendInteractions: Interaction[] = [];
    for (const interaction of recentInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some((jf: InteractionFriend) => jf.friendId === friend.id)) {
        friendInteractions.push(interaction);
      }
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = friendInteractions.filter(
      i => i.interactionDate.getTime() >= thirtyDaysAgo
    ).length;

    // Healthy/Momentum
    if (recentCount >= 3 && weaveScore > 65) {
      return generateHealthyRelationshipInsight(friend, friendInteractions, recentCount);
    }

    // Cooling
    if (friendInteractions.length > 0) {
      const lastInteraction = friendInteractions[0];
      const timeStr = getShortRelativeTime(lastInteraction.interactionDate);
      const daysSince = differenceInDays(new Date(), lastInteraction.interactionDate);

      // Warning thresholds
      const isInnerCircleLate = friend.dunbarTier === 'InnerCircle' && daysSince >= 14;
      const isCloseFriendLate = friend.dunbarTier === 'CloseFriends' && daysSince >= 21;

      if ((isInnerCircleLate || isCloseFriendLate) && weaveScore < 65) {
        return {
          text: `${timeStr}`,
          subtext: 'Time to reconnect?',
          variant: 'default'
        };
      }
    }
  } catch (error) {
    console.error('Error checking connection health:', error);
  }

  return null;
}

/**
 * PRIORITY 3: Upcoming plans
 */
async function checkUpcomingPlans(friend: HydratedFriend | Friend): Promise<StatusLine | null> {
  try {
    const now = Date.now();
    const futureInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'planned'),
        Q.where('interaction_date', Q.gt(now)),
        Q.sortBy('interaction_date', Q.asc),
        Q.take(15)
      )
      .fetch();

    const friendPlans: Interaction[] = [];
    for (const interaction of futureInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some((jf: InteractionFriend) => jf.friendId === friend.id)) {
        friendPlans.push(interaction);
      }
    }

    if (friendPlans.length === 0) return null;

    const nextPlan = friendPlans[0];
    const today = startOfDay(new Date());
    const daysUntil = differenceInDays(startOfDay(nextPlan.interactionDate), today);
    const categoryLabel = nextPlan.interactionCategory ? nextPlan.interactionCategory.replace('-', ' ') : 'plans';

    if (daysUntil === 0) return { text: `${categoryLabel} later today`, icon: 'Calendar', variant: 'accent' };
    if (daysUntil === 1) return { text: `${categoryLabel} tomorrow`, icon: 'Calendar', variant: 'accent' };
    if (daysUntil <= 7) return { text: `${categoryLabel} on ${format(nextPlan.interactionDate, 'EEEE')}`, icon: 'Calendar', variant: 'default' };
    if (daysUntil <= 30) return { text: `${categoryLabel} in ${daysUntil} days`, icon: 'Calendar', variant: 'default' };

  } catch (error) {
    console.error('Error checking plans:', error);
  }

  return null;
}

/**
 * Main function: Generate intelligent status line for a friend
 */
export async function generateIntelligentStatusLine(friend: HydratedFriend | Friend): Promise<StatusLine> {
  // 1. Life events
  const lifeEventStatus = await checkLifeEventStatus(friend);
  if (lifeEventStatus) return lifeEventStatus;

  // 2. Connection health (Healthy or Cooling)
  const healthStatus = await checkConnectionHealth(friend);
  if (healthStatus) return healthStatus;

  // 3. Upcoming plans
  const planStatus = await checkUpcomingPlans(friend);
  if (planStatus) return planStatus;

  // 4. Fallback (Data-driven Nudge)
  // Use lastInteractionDate if available to give context
  if (friend.lastInteractionDate) {
    const timeStr = getShortRelativeTime(friend.lastInteractionDate);
    return {
      text: `${timeStr}`,
      subtext: 'Reach out?',
      variant: 'default'
    };
  }

  // Truly no data found
  return {
    text: 'Start your journey together',
    variant: 'default',
  };
}
