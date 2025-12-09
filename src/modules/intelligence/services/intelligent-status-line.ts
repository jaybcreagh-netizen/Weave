import { differenceInDays, format, startOfDay } from 'date-fns';
import { parseFlexibleDate } from '@/shared/utils/date-utils';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from './orchestrator.service';
import { type Friend } from '@/components/types';
import { HydratedFriend, HydratedLifeEvent } from '@/types/hydrated';

export interface StatusLine {
  text: string;
  icon?: string;
  variant?: 'default' | 'accent' | 'warning' | 'success';
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
async function checkLifeEventStatus(friend: HydratedFriend | Friend): Promise<StatusLine | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Check database life events (past 7 days or upcoming 30 days)
    const activeLifeEvents = await database
      .get<LifeEvent>('life_events')
      .query(
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
        return { text: `${topEvent.title || topEvent.eventType} is today!`, icon, variant: 'accent' };
      } else if (daysUntil === 1) {
        return { text: `${topEvent.title || topEvent.eventType} is tomorrow`, icon, variant: 'accent' };
      } else if (daysUntil > 1 && daysUntil <= 30) {
        return { text: `${topEvent.title || topEvent.eventType} in ${daysUntil} days`, icon, variant: 'default' };
      } else if (daysUntil < 0 && daysUntil >= -7) {
        const daysAgo = Math.abs(daysUntil);
        if (daysAgo === 1) {
          return { text: `${topEvent.title || topEvent.eventType} was yesterday`, icon, variant: 'warning' };
        }
        return { text: `${topEvent.title || topEvent.eventType} was ${daysAgo} days ago`, icon, variant: 'warning' };
      }
    }

    // Check birthday (legacy Friend model field)
    if (friend.birthday) {
      // Use flexible parser
      const dateParts = parseFlexibleDate(friend.birthday);

      if (!dateParts) {
        console.warn(`[StatusLine] Invalid birthday format: ${friend.birthday}`);
      } else {
        const { month, day } = dateParts;

        // Validate date components (just in case)
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          console.warn(`[StatusLine] Invalid birthday date: ${friend.birthday}`);
        } else {
          // Create birthday for this year
          const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
          birthdayThisYear.setHours(0, 0, 0, 0);

          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(today.getFullYear() + 1);
          }

          const daysUntil = differenceInDays(birthdayThisYear, today);
          if (daysUntil >= 0 && daysUntil <= 7) {
            if (daysUntil === 0) return { text: 'Birthday is today!', icon: '🎂', variant: 'accent' };
            if (daysUntil === 1) return { text: 'Birthday is tomorrow', icon: '🎂', variant: 'accent' };
            return { text: `Birthday in ${daysUntil} days`, icon: '🎂', variant: 'default' };
          }
        }
      }
    }

    // Check anniversary (legacy Friend model field)
    if (friend.anniversary) {
      // Use flexible parser
      const dateParts = parseFlexibleDate(friend.anniversary);

      if (!dateParts) {
        console.warn(`[StatusLine] Invalid anniversary format: ${friend.anniversary}`);
      } else {
        const { month, day } = dateParts;

        // Validate date components (just in case)
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          console.warn(`[StatusLine] Invalid anniversary date: ${friend.anniversary}`);
        } else {
          // Create anniversary for this year
          const anniversaryThisYear = new Date(today.getFullYear(), month - 1, day);
          anniversaryThisYear.setHours(0, 0, 0, 0);

          if (anniversaryThisYear < today) {
            anniversaryThisYear.setFullYear(today.getFullYear() + 1);
          }

          const daysUntil = differenceInDays(anniversaryThisYear, today);
          if (daysUntil >= 0 && daysUntil <= 7) {
            if (daysUntil === 0) return { text: 'Friendship anniversary today!', icon: '💝', variant: 'accent' };
            if (daysUntil === 1) return { text: 'Friendship anniversary tomorrow', icon: '💝', variant: 'accent' };
            return { text: `Anniversary in ${daysUntil} days`, icon: '💝', variant: 'default' };
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking life events:', error);
  }

  return null;
}

/**
 * Generate varied, insightful status messages for healthy relationships
 * Analyzes recent interaction patterns to provide specific, meaningful insights
 */
function generateHealthyRelationshipInsight(
  friend: HydratedFriend | Friend,
  recentInteractions: Interaction[],
  recentCount: number
): StatusLine {
  // Analyze interaction patterns
  const categoryCount: Record<string, number> = {};
  let totalWithVibe = 0;
  let positiveVibeCount = 0;

  recentInteractions.forEach(interaction => {
    const cat = interaction.interactionCategory || 'other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;

    // Track vibe quality if available
    if (interaction.vibe) {
      totalWithVibe++;
      if (interaction.vibe === 'great' || interaction.vibe === 'good') {
        positiveVibeCount++;
      }
    }
  });

  // Find dominant interaction type
  const dominantCategory = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)[0];
  const dominantType = dominantCategory ? dominantCategory[0] : null;
  const dominantCount = dominantCategory ? dominantCategory[1] : 0;
  const hasVariety = Object.keys(categoryCount).length >= 3;

  // Calculate consistency (interactions spread over time vs bunched)
  const daysSinceFirst = differenceInDays(new Date(), recentInteractions[recentInteractions.length - 1].interactionDate);
  const isConsistent = daysSinceFirst >= 21 && recentCount >= 4; // 4+ weaves over 3+ weeks

  // Quality indicator (if vibe data exists)
  const hasHighQuality = totalWithVibe >= 2 && (positiveVibeCount / totalWithVibe) >= 0.75;

  // Archetype-aligned insights
  const archetypeInsights: Record<string, { types: string[], messages: string[] }> = {
    Emperor: {
      types: ['meal-drink', 'activity-hobby'],
      messages: [
        'Your structured time together is thriving',
        'Consistent, purposeful connection',
        'Building a strong routine together',
      ]
    },
    Empress: {
      types: ['meal-drink', 'favor-support'],
      messages: [
        'Nurturing this bond beautifully',
        'Creating real comfort together',
        'This warmth is mutual and strong',
      ]
    },
    HighPriestess: {
      types: ['deep-talk', 'text-call'],
      messages: [
        'Your deep conversations are flowing',
        'Real vulnerability and trust here',
        'Meaningful exchanges are frequent',
      ]
    },
    Fool: {
      types: ['activity-hobby', 'event-party'],
      messages: [
        'Adventures together are on fire',
        'Keeping the spontaneity alive',
        'Your playful energy is strong',
      ]
    },
    Sun: {
      types: ['event-party', 'celebration'],
      messages: [
        'Celebrating life together often',
        'Your bright energy is consistent',
        'Joyful moments are abundant',
      ]
    },
    Hermit: {
      types: ['deep-talk', 'hangout'],
      messages: [
        'Quality one-on-one time is rich',
        'Thoughtful connection is consistent',
        'Your quiet moments together matter',
      ]
    },
    Magician: {
      types: ['activity-hobby', 'hangout'],
      messages: [
        'Creating and building together',
        'Collaborative energy is strong',
        'Making magic through shared projects',
      ]
    },
  };

  // Priority 1: Archetype-aligned insights (if dominant type matches archetype affinity)
  const archetypeData = archetypeInsights[friend.archetype];
  if (archetypeData && dominantType && archetypeData.types.includes(dominantType) && dominantCount >= 2) {
    const message = archetypeData.messages[Math.floor(Math.random() * archetypeData.messages.length)];
    return { text: message, icon: '✨', variant: 'accent' };
  }

  // Priority 2: High-quality interactions
  if (hasHighQuality) {
    const qualityMessages = [
      'Quality time together is exceptional',
      'Really meaningful moments lately',
      'Deep connection is thriving',
    ];
    return { text: qualityMessages[Math.floor(Math.random() * qualityMessages.length)], icon: '💫', variant: 'accent' };
  }

  // Priority 3: Consistency/streak insights
  if (isConsistent) {
    const consistencyMessages = [
      `${recentCount} weaves in ${Math.floor(daysSinceFirst / 7)} weeks—solid rhythm`,
      'Consistent connection over time',
      'Building a reliable pattern together',
    ];
    return { text: consistencyMessages[Math.floor(Math.random() * consistencyMessages.length)], icon: '🌱', variant: 'success' };
  }

  // Priority 4: Interaction type patterns
  if (dominantType && dominantCount >= 2) {
    const typeInsights: Record<string, { messages: string[], icon: string }> = {
      'deep-talk': {
        messages: [
          `${dominantCount} deep talks lately—real connection`,
          'Vulnerability and openness are strong',
        ],
        icon: '💭'
      },
      'meal-drink': {
        messages: [
          `${dominantCount} meals together this month`,
          'Your dining tradition is strong',
        ],
        icon: '🥂'
      },
      'activity-hobby': {
        messages: [
          `${dominantCount} activities together lately`,
          'Shared interests are thriving',
        ],
        icon: '🏂'
      },
      'text-call': {
        messages: [
          `${dominantCount} calls/texts—staying close`,
          'Regular check-ins are working',
        ],
        icon: '📱'
      },
      'hangout': {
        messages: [
          `${dominantCount} hangouts this month`,
          'Just being together is enough',
          'Just being together is enough',
        ],
        icon: '🛋️'
      },
      'event-party': {
        messages: [
          `${dominantCount} events together lately`,
          'Social moments are abundant',
        ],
        icon: '🎉'
      },
    };

    const insight = typeInsights[dominantType];
    if (insight) {
      return { text: insight.messages[Math.floor(Math.random() * insight.messages.length)], icon: insight.icon, variant: 'default' };
    }
  }

  // Priority 5: Variety insight
  if (hasVariety) {
    return { text: `${recentCount} weaves across ${Object.keys(categoryCount).length} different types`, icon: '🎨', variant: 'default' };
  }

  // Fallback: Simple momentum message (but more varied)
  const momentumMessages = [
    `${recentCount} weaves this month—strong bond`,
    `Maintaining momentum with ${recentCount} weaves`,
    `${recentCount} quality moments together`,
  ];
  return { text: momentumMessages[Math.floor(Math.random() * momentumMessages.length)], icon: '🌟', variant: 'default' };
}

/**
 * PRIORITY 2: Connection health & history
 */
async function checkConnectionHealth(friend: HydratedFriend | Friend): Promise<StatusLine | null> {
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
      if (interactionFriends.some((jf: InteractionFriend) => jf.friendId === friend.id)) {
        friendInteractions.push(interaction);
      }
    }

    // Check for warming/momentum (3+ weaves in last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = friendInteractions.filter(
      i => i.interactionDate.getTime() >= thirtyDaysAgo
    ).length;

    if (recentCount >= 3 && weaveScore > 65) {
      // Generate varied, insightful status messages for healthy relationships
      return generateHealthyRelationshipInsight(friend, friendInteractions.filter(
        i => i.interactionDate.getTime() >= thirtyDaysAgo
      ), recentCount);
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
          return { text: `Last ${typeLabel}: 2 weeks ago`, variant: 'default' };
        } else if (daysSince === 21) {
          return { text: `Last ${typeLabel}: 3 weeks ago`, variant: 'default' };
        } else if (daysSince >= 28) {
          const weeks = Math.floor(daysSince / 7);
          return { text: `Last ${typeLabel}: ${weeks} weeks ago`, variant: 'default' };
        }
      }

      // For Close Friends, flag after 3+ weeks
      if (friend.dunbarTier === 'CloseFriends' && daysSince >= 21 && weaveScore < 65) {
        const typeLabel = getCategoryLabel(lastMeaningfulType);
        const weeks = Math.floor(daysSince / 7);
        return { text: `Last ${typeLabel}: ${weeks} weeks ago`, variant: 'default' };
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
    const today = startOfDay(new Date());

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
      if (interactionFriends.some((jf: InteractionFriend) => jf.friendId === friend.id)) {
        // Use startOfDay on both dates for accurate calendar-day comparison
        const daysUntil = differenceInDays(startOfDay(interaction.interactionDate), today);
        const categoryLabel = getCategoryLabel(interaction.interactionCategory);

        if (daysUntil === 0) {
          return { text: `${capitalize(categoryLabel)} planned for today!`, icon: '🗓️', variant: 'accent' };
        } else if (daysUntil === 1) {
          return { text: `${capitalize(categoryLabel)} planned for tomorrow`, icon: '🗓️', variant: 'accent' };
        } else if (daysUntil <= 7) {
          const dayName = format(interaction.interactionDate, 'EEEE');
          return { text: `${capitalize(categoryLabel)} planned for ${dayName}`, icon: '🗓️', variant: 'default' };
        } else if (daysUntil <= 30) {
          return { text: `${capitalize(categoryLabel)} planned in ${daysUntil} days`, icon: '🗓️', variant: 'default' };
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
export async function generateIntelligentStatusLine(friend: HydratedFriend | Friend): Promise<StatusLine> {
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
    variant: 'default',
  };
}
