/**
 * Weekly Stats Calculator
 * Calculates summary statistics for the past week's weaving activity
 */

import { database } from '../../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../../db/models/Friend';
import InteractionModel from '../../db/models/Interaction';
import InteractionFriend from '../../db/models/InteractionFriend';
import { Archetype } from '../../components/types';
import { getRandomActionForArchetype, getArchetypeValue } from './archetype-actions';

export interface MissedFriend {
  friend: FriendModel;
  suggestedAction: string;
  archetypeValue: string;
  weaveScore: number;
  daysSinceLastContact: number;
}

export interface WeeklySummary {
  totalWeaves: number;
  friendsContacted: number;
  missedFriends: MissedFriend[];
  topActivity: string;
  topActivityCount: number;
  weekStartDate: Date;
  weekEndDate: Date;
}

/**
 * Calculate weekly summary statistics
 */
export async function calculateWeeklySummary(): Promise<WeeklySummary> {
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  const weekStart = new Date(weekAgo);
  const weekEnd = new Date(now);

  // Get completed interactions from past week
  const interactions = await database
    .get<InteractionModel>('interactions')
    .query(
      Q.where('interaction_date', Q.gte(weekAgo)),
      Q.where('status', 'completed')
    )
    .fetch();

  // Get friend links for these interactions
  const interactionIds = interactions.map(i => i.id);
  const friendLinks = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
    .fetch();

  // Count unique friends contacted
  const contactedFriendIds = new Set(friendLinks.map(fl => fl.friendId));

  // Find missed friends (Inner Circle + Close Friends with no contact and low scores)
  const allImportantFriends = await database
    .get<FriendModel>('friends')
    .query(
      Q.or(
        Q.where('dunbar_tier', 'InnerCircle'),
        Q.where('dunbar_tier', 'CloseFriends')
      ),
      Q.where('is_dormant', false)
    )
    .fetch();

  // Calculate days since last contact for each missed friend
  const missedFriendsData: MissedFriend[] = [];

  for (const friend of allImportantFriends) {
    if (!contactedFriendIds.has(friend.id) && friend.weaveScore < 60) {
      // Get their last interaction date
      const lastInteractions = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('friend_id', friend.id))
        .fetch();

      let daysSinceLastContact = 999; // Default to very high

      if (lastInteractions.length > 0) {
        // Get the most recent interaction
        const interactionModels = await Promise.all(
          lastInteractions.map(async (link) => {
            try {
              return await database.get<InteractionModel>('interactions').find(link.interactionId);
            } catch {
              return null;
            }
          })
        );

        const validInteractions = interactionModels.filter(i => i !== null) as InteractionModel[];

        if (validInteractions.length > 0) {
          const mostRecent = validInteractions.reduce((latest, current) => {
            const latestDate = typeof latest.interactionDate === 'number'
              ? latest.interactionDate
              : new Date(latest.interactionDate).getTime();
            const currentDate = typeof current.interactionDate === 'number'
              ? current.interactionDate
              : new Date(current.interactionDate).getTime();
            return currentDate > latestDate ? current : latest;
          });

          const lastContactDate = typeof mostRecent.interactionDate === 'number'
            ? mostRecent.interactionDate
            : new Date(mostRecent.interactionDate).getTime();

          daysSinceLastContact = Math.floor((now - lastContactDate) / (24 * 60 * 60 * 1000));
        }
      }

      const archetype = friend.archetype as Archetype;
      missedFriendsData.push({
        friend,
        suggestedAction: getRandomActionForArchetype(archetype),
        archetypeValue: getArchetypeValue(archetype),
        weaveScore: friend.weaveScore,
        daysSinceLastContact,
      });
    }
  }

  // Sort missed friends by weave score (lowest first) and limit to top 5
  const missedFriends = missedFriendsData
    .sort((a, b) => a.weaveScore - b.weaveScore)
    .slice(0, 5);

  // Find most common activity
  const activityCounts: Record<string, number> = {};

  interactions.forEach(interaction => {
    // Use interactionCategory if available, fall back to activity
    const activity = interaction.interactionCategory || interaction.activity || 'Unknown';
    activityCounts[activity] = (activityCounts[activity] || 0) + 1;
  });

  const sortedActivities = Object.entries(activityCounts).sort(([, a], [, b]) => b - a);
  const [topActivity, topActivityCount] = sortedActivities[0] || ['None', 0];

  return {
    totalWeaves: interactions.length,
    friendsContacted: contactedFriendIds.size,
    missedFriends,
    topActivity: formatActivityName(topActivity),
    topActivityCount,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
  };
}

/**
 * Format activity name for display
 */
function formatActivityName(activity: string): string {
  const categoryLabels: Record<string, string> = {
    'text-call': 'Texting & Calls',
    'voice-note': 'Voice Notes',
    'meal-drink': 'Meals & Drinks',
    'hangout': 'Hangouts',
    'deep-talk': 'Deep Conversations',
    'event-party': 'Events & Parties',
    'activity-hobby': 'Activities & Hobbies',
    'favor-support': 'Support & Favors',
    'celebration': 'Celebrations',
  };

  return categoryLabels[activity] || activity;
}
