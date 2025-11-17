import { differenceInDays, format } from 'date-fns';
import { database } from '../db';
import LifeEvent from '../db/models/LifeEvent';
import FriendModel from '../db/models/Friend';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';

interface StatusLine {
  text: string;
  icon?: string;
}

// Life event emoji mapping
const LIFE_EVENT_ICONS: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💝',
  new_job: '💼',
  moving: '📦',
  wedding: '💒',
  baby: '👶',
  loss: '🕊️',
  health_event: '🏥',
  graduation: '🎓',
  celebration: '🎉',
  other: '✨',
};

// Archetype-driven actionable nudges
const ARCHETYPE_NUDGES: Record<string, string[]> = {
  Emperor: [
    'Ready to plan something together?',
    'A structured catch-up would feel good',
    'Time to reconnect with purpose',
  ],
  Empress: [
    'A good time to nurture this bond',
    'Ready for some comfort and connection?',
    'Time to create warmth together',
  ],
  HighPriestess: [
    'A deep conversation would mean a lot',
    'Space for meaningful connection',
    'Ready for real talk?',
  ],
  Fool: [
    'Ready for a new adventure together?',
    'Time for spontaneous fun',
    'Let\'s try something unexpected',
  ],
  Sun: [
    'Time to celebrate this friendship',
    'Ready to bring the energy?',
    'A bright moment together awaits',
  ],
  Hermit: [
    'Quality one-on-one time would be special',
    'A quiet moment together sounds nice',
    'Ready for thoughtful connection?',
  ],
  Magician: [
    'Ready to create something together?',
    'A collaborative moment would spark joy',
    'Time to build something meaningful',
  ],
};

function getRandomNudge(archetype: string): string {
  const nudges = ARCHETYPE_NUDGES[archetype] || ['Time to reconnect'];
  return nudges[Math.floor(Math.random() * nudges.length)];
}

/**
 * PRIORITY 1: Check for urgent life events
 */
async function checkLifeEventStatus(friend: FriendModel): Promise<StatusLine | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Check database life events (past 7 days or upcoming 30 days)
    const activeLifeEvents = await database
      .get<LifeEvent>('life_events')
      .query(
        // @ts-ignore
        Q.where('friend_id', friend.id),
        Q.or(
          // Upcoming events (within next 30 days)
          Q.and(
            Q.where('event_date', Q.gte(today.getTime())),
            Q.where('event_date', Q.lte(today.getTime() + 30 * 24 * 60 * 60 * 1000))
          ),
          // Recent past events (last 7 days for follow-up)
          Q.and(
            Q.where('event_date', Q.gte(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
            Q.where('event_date', Q.lt(today.getTime()))
          )
        )
      )
      .fetch();

    // Prioritize by importance and proximity
    const sortedEvents = activeLifeEvents.sort((a, b) => {
      const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = importanceOrder[a.importance];
      const bScore = importanceOrder[b.importance];
      if (aScore !== bScore) return bScore - aScore;
      return Math.abs(differenceInDays(a.eventDate, today)) - Math.abs(differenceInDays(b.eventDate, today));
    });

    if (sortedEvents.length > 0) {
      const topEvent = sortedEvents[0];
      const daysUntil = differenceInDays(topEvent.eventDate, today);
      const icon = LIFE_EVENT_ICONS[topEvent.eventType] || '✨';

      if (daysUntil === 0) {
        return { text: `${topEvent.title || topEvent.eventType} is today!`, icon };
      } else if (daysUntil === 1) {
        return { text: `${topEvent.title || topEvent.eventType} is tomorrow`, icon };
      } else if (daysUntil > 1 && daysUntil <= 30) {
        return { text: `${topEvent.title || topEvent.eventType} in ${daysUntil} days`, icon };
      } else if (daysUntil < 0 && daysUntil >= -7) {
        const daysAgo = Math.abs(daysUntil);
        if (daysAgo === 1) {
          return { text: `${topEvent.title || topEvent.eventType} was yesterday`, icon };
        }
        return { text: `${topEvent.title || topEvent.eventType} was ${daysAgo} days ago`, icon };
      }
    }

    // Check birthday (legacy Friend model field)
    if (friend.birthday) {
      // Birthday is now in "MM-DD" format
      const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));

      // Create birthday for this year
      const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
      birthdayThisYear.setHours(0, 0, 0, 0);

      if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(today.getFullYear() + 1);
      }

      const daysUntil = differenceInDays(birthdayThisYear, today);
      if (daysUntil >= 0 && daysUntil <= 7) {
        if (daysUntil === 0) return { text: 'Birthday is today!', icon: '🎂' };
        if (daysUntil === 1) return { text: 'Birthday is tomorrow', icon: '🎂' };
        return { text: `Birthday in ${daysUntil} days`, icon: '🎂' };
      }
    }

    // Check anniversary (legacy Friend model field)
    if (friend.anniversary) {
      const anniversaryThisYear = new Date(friend.anniversary);
      anniversaryThisYear.setFullYear(today.getFullYear());
      anniversaryThisYear.setHours(0, 0, 0, 0);

      if (anniversaryThisYear < today) {
        anniversaryThisYear.setFullYear(today.getFullYear() + 1);
      }

      const daysUntil = differenceInDays(anniversaryThisYear, today);
      if (daysUntil >= 0 && daysUntil <= 7) {
        if (daysUntil === 0) return { text: 'Friendship anniversary today!', icon: '💝' };
        if (daysUntil === 1) return { text: 'Friendship anniversary tomorrow', icon: '💝' };
        return { text: `Anniversary in ${daysUntil} days`, icon: '💝' };
      }
    }
  } catch (error) {
    console.error('Error checking life events:', error);
  }

  return null;
}

/**
 * PRIORITY 2: Connection health & history
 */
async function checkConnectionHealth(friend: FriendModel): Promise<StatusLine | null> {
  const weaveScore = calculateCurrentScore(friend);

  try {
    // Get recent interactions (last 60 days, completed only)
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const recentInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(sixtyDaysAgo)),
        Q.sortBy('interaction_date', Q.desc)
      )
      .fetch();

    // Filter to interactions with this friend
    const friendInteractions: Interaction[] = [];
    for (const interaction of recentInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some(jf => jf.friendId === friend.id)) {
        friendInteractions.push(interaction);
      }
    }

    // Check for warming/momentum (3+ weaves in last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = friendInteractions.filter(
      i => i.interactionDate.getTime() >= thirtyDaysAgo
    ).length;

    if (recentCount >= 3 && weaveScore > 65) {
      return { text: `You're on a roll! ${recentCount} weaves this month`, icon: '🌟' };
    }

    // Check for cooling connection
    if (friendInteractions.length > 0) {
      const lastInteraction = friendInteractions[0];
      const daysSince = differenceInDays(new Date(), lastInteraction.interactionDate);

      // Find most recent meaningful interaction type
      const lastMeaningfulType = lastInteraction.interactionCategory;

      // For Inner Circle, flag after 2+ weeks
      if (friend.dunbarTier === 'InnerCircle' && daysSince >= 14 && weaveScore < 65) {
        const typeLabel = getCategoryLabel(lastMeaningfulType);
        if (daysSince === 14) {
          return { text: `Last ${typeLabel} was 2 weeks ago` };
        } else if (daysSince === 21) {
          return { text: `Last ${typeLabel} was 3 weeks ago` };
        } else if (daysSince >= 28) {
          const weeks = Math.floor(daysSince / 7);
          return { text: `Last ${typeLabel} was ${weeks} weeks ago` };
        }
      }

      // For Close Friends, flag after 3+ weeks
      if (friend.dunbarTier === 'CloseFriends' && daysSince >= 21 && weaveScore < 65) {
        const typeLabel = getCategoryLabel(lastMeaningfulType);
        const weeks = Math.floor(daysSince / 7);
        return { text: `Last ${typeLabel} was ${weeks} weeks ago` };
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
async function checkUpcomingPlans(friend: FriendModel): Promise<StatusLine | null> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'planned'),
        Q.where('interaction_date', Q.gte(today.getTime())),
        Q.sortBy('interaction_date', Q.asc)
      )
      .fetch();

    // Find the nearest upcoming interaction with this friend
    for (const interaction of futureInteractions) {
      const interactionFriends = await interaction.interactionFriends.fetch();
      if (interactionFriends.some(jf => jf.friendId === friend.id)) {
        const daysUntil = differenceInDays(interaction.interactionDate, today);
        const categoryLabel = getCategoryLabel(interaction.interactionCategory);

        if (daysUntil === 0) {
          return { text: `${capitalize(categoryLabel)} planned for today!`, icon: '🗓️' };
        } else if (daysUntil === 1) {
          return { text: `${capitalize(categoryLabel)} planned for tomorrow`, icon: '🗓️' };
        } else if (daysUntil <= 7) {
          const dayName = format(interaction.interactionDate, 'EEEE');
          return { text: `${capitalize(categoryLabel)} planned for ${dayName}`, icon: '🗓️' };
        } else if (daysUntil <= 30) {
          return { text: `${capitalize(categoryLabel)} planned in ${daysUntil} days`, icon: '🗓️' };
        }
        // If plan is >30 days away, don't show it (falls through to archetype nudge)
      }
    }
  } catch (error) {
    console.error('Error checking upcoming plans:', error);
  }

  return null;
}

/**
 * Helper: Get friendly category label
 */
function getCategoryLabel(category: string | null | undefined): string {
  const labels: Record<string, string> = {
    'text-call': 'chat',
    'meal-drink': 'meal',
    'hangout': 'hangout',
    'deep-talk': 'deep talk',
    'activity-hobby': 'activity',
    'event-party': 'event',
    'favor-support': 'time together',
    'celebration': 'celebration',
  };
  return labels[category || ''] || 'catch-up';
}

/**
 * Helper: Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Main function: Generate intelligent status line for a friend
 * Follows priority order:
 * 1. Life events
 * 2. Connection health
 * 3. Upcoming plans
 * 4. Archetype nudge (fallback)
 */
export async function generateIntelligentStatusLine(friend: FriendModel): Promise<StatusLine> {
  // Priority 1: Life events
  const lifeEventStatus = await checkLifeEventStatus(friend);
  if (lifeEventStatus) return lifeEventStatus;

  // Priority 2: Connection health
  const healthStatus = await checkConnectionHealth(friend);
  if (healthStatus) return healthStatus;

  // Priority 3: Upcoming plans
  const planStatus = await checkUpcomingPlans(friend);
  if (planStatus) return planStatus;

  // Priority 4: Archetype-driven nudge (fallback)
  return {
    text: getRandomNudge(friend.archetype),
    icon: undefined,
  };
}
