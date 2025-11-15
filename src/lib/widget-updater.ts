/**
 * Widget Updater
 * Extracts Today's Focus data and updates iOS home screen widget
 */

import { differenceInDays } from 'date-fns';
import { database } from '../db';
import FriendModel from '../db/models/Friend';
import Interaction from '../db/models/Interaction';
import LifeEvent from '../db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from './weave-engine';
import { WidgetBridge, type WidgetFocusData } from '../../modules/widget-bridge/src';

type PriorityState = 'pressing-event' | 'todays-plan' | 'streak-risk' | 'friend-fading' | 'upcoming-plan' | 'quick-weave' | 'all-clear';

interface UpcomingDate {
  friend: FriendModel;
  type: 'birthday' | 'anniversary' | 'life_event';
  daysUntil: number;
  title?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
}

interface PendingPlan {
  interaction: Interaction;
  friends: FriendModel[];
  daysUntil: number;
}

/**
 * Get daily rotation index for variety (same result for same day)
 */
const getDailyRotation = (arrayLength: number): number => {
  if (arrayLength === 0) return 0;
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
  return dayOfYear % arrayLength;
};

/**
 * Calculate current streak
 */
const calculateStreak = async (): Promise<number> => {
  try {
    const interactions = await database
      .get<Interaction>('interactions')
      .query(Q.where('status', 'completed'), Q.sortBy('interaction_date', Q.desc))
      .fetch();

    if (interactions.length === 0) {
      return 0;
    }

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const interaction of interactions) {
      const interactionDate = new Date(interaction.interactionDate);
      interactionDate.setHours(0, 0, 0, 0);
      const daysDiff = differenceInDays(today, interactionDate);

      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('[WidgetUpdater] Error calculating streak:', error);
    return 0;
  }
};

/**
 * Get upcoming dates (birthdays, anniversaries, life events)
 */
const getUpcomingDates = async (friends: FriendModel[]): Promise<UpcomingDate[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events: UpcomingDate[] = [];

  // Load life events
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const lifeEvents = await database
      .get<LifeEvent>('life_events')
      .query(
        Q.where('event_date', Q.gte(today.getTime())),
        Q.where('event_date', Q.lte(thirtyDaysFromNow.getTime()))
      )
      .fetch();

    lifeEvents.forEach(event => {
      const friend = friends.find(f => f.id === event.friendId);
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

    // Check birthdays
    const currentYear = today.getFullYear();
    friends.forEach(friend => {
      if (friend.birthday) {
        try {
          const birthdayThisYear = new Date(friend.birthday);
          birthdayThisYear.setFullYear(currentYear);
          birthdayThisYear.setHours(0, 0, 0, 0);

          let daysUntil = differenceInDays(birthdayThisYear, today);

          // If birthday already passed, check next year
          if (daysUntil < 0) {
            birthdayThisYear.setFullYear(currentYear + 1);
            daysUntil = differenceInDays(birthdayThisYear, today);
          }

          // Only include birthdays within 30 days
          if (daysUntil >= 0 && daysUntil <= 30) {
            events.push({
              friend,
              type: 'birthday',
              daysUntil,
              importance: 'high',
            });
          }
        } catch (error) {
          console.error('[WidgetUpdater] Error processing birthday for', friend.name);
        }
      }

      // Check anniversaries
      if (friend.friendshipAnniversary) {
        try {
          const anniversaryThisYear = new Date(friend.friendshipAnniversary);
          anniversaryThisYear.setFullYear(currentYear);
          anniversaryThisYear.setHours(0, 0, 0, 0);

          let daysUntil = differenceInDays(anniversaryThisYear, today);

          // If anniversary already passed, check next year
          if (daysUntil < 0) {
            anniversaryThisYear.setFullYear(currentYear + 1);
            daysUntil = differenceInDays(anniversaryThisYear, today);
          }

          // Only include anniversaries within 30 days
          if (daysUntil >= 0 && daysUntil <= 30) {
            events.push({
              friend,
              type: 'anniversary',
              daysUntil,
              importance: 'medium',
            });
          }
        } catch (error) {
          console.error('[WidgetUpdater] Error processing anniversary for', friend.name);
        }
      }
    });

    // Sort by proximity
    events.sort((a, b) => a.daysUntil - b.daysUntil);
  } catch (error) {
    console.error('[WidgetUpdater] Error loading upcoming dates:', error);
  }

  return events;
};

/**
 * Get pending plans
 */
const getPendingPlans = async (): Promise<PendingPlan[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const interactions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'pending'),
        Q.where('interaction_date', Q.gte(today.getTime())),
        Q.sortBy('interaction_date', Q.asc)
      )
      .fetch();

    const plans: PendingPlan[] = [];

    for (const interaction of interactions) {
      const friends = await interaction.friends.fetch();
      const daysUntil = differenceInDays(interaction.interactionDate, today);

      plans.push({
        interaction,
        friends,
        daysUntil,
      });
    }

    return plans;
  } catch (error) {
    console.error('[WidgetUpdater] Error loading pending plans:', error);
    return [];
  }
};

/**
 * Get fading friend (lowest score)
 */
const getFadingFriend = (friends: FriendModel[]): { friend: FriendModel; score: number } | null => {
  if (!friends || friends.length === 0) return null;

  const friendsWithScores = friends.map(f => ({
    friend: f,
    score: calculateCurrentScore(f),
  }));

  const fadingFriends = friendsWithScores
    .filter(f => f.score < 40)
    .sort((a, b) => a.score - b.score);

  if (fadingFriends.length > 0) {
    const index = getDailyRotation(fadingFriends.length);
    return fadingFriends[index];
  }

  return null;
};

/**
 * Get priority state and data
 */
const getPriority = async (
  friends: FriendModel[],
  upcomingDates: UpcomingDate[],
  pendingPlans: PendingPlan[],
  streakCount: number
): Promise<{ state: PriorityState; data?: any }> => {
  // 1. Pressing events (critical life events within 7 days)
  const pressingEvents = upcomingDates.filter(event => {
    if (event.type === 'life_event' && event.importance === 'critical' && event.daysUntil >= 0 && event.daysUntil <= 7) return true;
    return false;
  });
  if (pressingEvents.length > 0) {
    pressingEvents.sort((a, b) => a.daysUntil - b.daysUntil);
    return { state: 'pressing-event', data: pressingEvents[0] };
  }

  // 2. Today's plans
  const todaysPlans = pendingPlans.filter(p => p.daysUntil === 0);
  if (todaysPlans.length > 0) {
    return { state: 'todays-plan', data: { plans: todaysPlans, count: todaysPlans.length } };
  }

  // 3. Streak at risk (simplified - no battery matching in widget updater)
  if (streakCount > 0) {
    const friendsWithInteractions = friends
      .filter(f => f.lastUpdated)
      .map(f => ({ friend: f, daysSince: differenceInDays(new Date(), f.lastUpdated!) }))
      .sort((a, b) => b.daysSince - a.daysSince);

    if (friendsWithInteractions.length > 0) {
      return { state: 'streak-risk', data: { streakCount, friend: friendsWithInteractions[0].friend } };
    }
  }

  // 4. Friend fading
  const fadingFriend = getFadingFriend(friends);
  if (fadingFriend) {
    return { state: 'friend-fading', data: fadingFriend };
  }

  // 5. Upcoming plan (within 3 days)
  const upcomingPlans = pendingPlans.filter(p => p.daysUntil > 0 && p.daysUntil <= 3);
  if (upcomingPlans.length > 0) {
    const index = getDailyRotation(upcomingPlans.length);
    return { state: 'upcoming-plan', data: upcomingPlans[index] };
  }

  // 6. All clear?
  const allFriendsHealthy = friends.every(f => calculateCurrentScore(f) >= 40);
  const noUrgentItems = !fadingFriend && pendingPlans.length === 0 && streakCount === 0;

  if (allFriendsHealthy && noUrgentItems) {
    return { state: 'all-clear', data: null };
  }

  // 7. Quick weave (default)
  const friendsWithInteractions = friends
    .filter(f => f.lastUpdated)
    .map(f => ({ friend: f, daysSince: differenceInDays(new Date(), f.lastUpdated!) }))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  if (friendsWithInteractions.length > 0) {
    const index = getDailyRotation(friendsWithInteractions.length);
    return { state: 'quick-weave', data: friendsWithInteractions[index] };
  }

  return { state: 'quick-weave', data: null };
};

/**
 * Format days info string
 */
const getDaysText = (days: number): string => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d`;
};

/**
 * Convert priority to widget data format
 */
const priorityToWidgetData = (priority: { state: PriorityState; data?: any }): WidgetFocusData => {
  const timestamp = Date.now();

  switch (priority.state) {
    case 'pressing-event': {
      const event = priority.data as UpcomingDate;
      const eventTitle = event.type === 'birthday' ? 'Birthday' : event.title || 'Important event';
      return {
        state: 'pressing-event',
        title: priority.data.daysUntil === 0 ? `${eventTitle} today!` : priority.data.daysUntil === 1 ? `${eventTitle} tomorrow!` : `${eventTitle} coming up`,
        subtitle: 'Plan something special',
        friendName: event.friend.name,
        daysInfo: event.daysUntil > 1 ? getDaysText(event.daysUntil) : undefined,
        deepLink: `weavenative://friend-profile?friendId=${event.friend.id}`,
        timestamp,
      };
    }

    case 'todays-plan': {
      const { plans, count } = priority.data;
      const firstPlan = plans[0] as PendingPlan;
      return {
        state: 'todays-plan',
        title: count === 1 ? 'Plan today' : `${count} plans today`,
        subtitle: firstPlan.interaction.title || 'Tap to view',
        friendName: firstPlan.friends[0]?.name,
        daysInfo: 'Today',
        deepLink: 'weavenative://home',
        timestamp,
      };
    }

    case 'streak-risk': {
      const { streakCount, friend } = priority.data;
      return {
        state: 'streak-risk',
        title: `${streakCount}-day streak at risk`,
        subtitle: `A quick weave with ${friend.name} could keep it going`,
        friendName: friend.name,
        deepLink: `weavenative://weave-logger?friendId=${friend.id}`,
        timestamp,
      };
    }

    case 'friend-fading': {
      const { friend, score } = priority.data;
      return {
        state: 'friend-fading',
        title: `Score dropping to ${Math.round(score)}`,
        subtitle: 'Plan something together',
        friendName: friend.name,
        daysInfo: `${Math.round(score)}`,
        deepLink: `weavenative://friend-profile?friendId=${friend.id}`,
        timestamp,
      };
    }

    case 'upcoming-plan': {
      const plan = priority.data as PendingPlan;
      return {
        state: 'upcoming-plan',
        title: plan.interaction.title || 'Upcoming plan',
        subtitle: plan.friends.map(f => f.name).join(', '),
        friendName: plan.friends[0]?.name,
        daysInfo: getDaysText(plan.daysUntil),
        deepLink: 'weavenative://home',
        timestamp,
      };
    }

    case 'quick-weave': {
      if (priority.data?.friend) {
        const { friend, daysSince } = priority.data;
        return {
          state: 'quick-weave',
          title: `${daysSince} days since last weave`,
          subtitle: 'Time to reconnect',
          friendName: friend.name,
          deepLink: `weavenative://weave-logger?friendId=${friend.id}`,
          timestamp,
        };
      }
      return {
        state: 'quick-weave',
        title: 'Stay connected',
        subtitle: 'Log a weave today',
        deepLink: 'weavenative://weave-logger',
        timestamp,
      };
    }

    case 'all-clear': {
      return {
        state: 'all-clear',
        title: 'All friendships healthy',
        subtitle: 'Keep up the great work!',
        deepLink: 'weavenative://home',
        timestamp,
      };
    }

    default:
      return {
        state: 'quick-weave',
        title: 'Weave',
        subtitle: 'Open app to connect',
        deepLink: 'weavenative://home',
        timestamp,
      };
  }
};

/**
 * Main function to update widget
 * Call this whenever app state changes
 */
export const updateWidget = async (): Promise<void> => {
  try {
    // Get all friends
    const friends = await database.get<FriendModel>('friends').query(Q.where('is_dormant', false)).fetch();

    if (friends.length === 0) {
      // No friends yet - show onboarding state
      await WidgetBridge.updateWidget({
        state: 'quick-weave',
        title: 'Add your first friend',
        subtitle: 'Start building your weave',
        deepLink: 'weavenative://add-friend',
        timestamp: Date.now(),
      });
      return;
    }

    // Calculate all data needed for priority
    const [upcomingDates, pendingPlans, streakCount] = await Promise.all([
      getUpcomingDates(friends),
      getPendingPlans(),
      calculateStreak(),
    ]);

    // Get priority
    const priority = await getPriority(friends, upcomingDates, pendingPlans, streakCount);

    // Convert to widget data and update
    const widgetData = priorityToWidgetData(priority);
    await WidgetBridge.updateWidget(widgetData);

    console.log('[WidgetUpdater] Widget updated successfully:', priority.state);
  } catch (error) {
    console.error('[WidgetUpdater] Error updating widget:', error);
  }
};
