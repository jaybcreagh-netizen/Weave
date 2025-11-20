/**
 * Reflection Friend Utilities
 * Fetch friends associated with a reflection week
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import WeeklyReflection from '@/db/models/WeeklyReflection';

export interface ReflectionFriend {
  friend: FriendModel;
  interactionCount: number;
}

/**
 * Get friends contacted during a reflection's week
 */
export async function getFriendsForReflection(reflection: WeeklyReflection): Promise<ReflectionFriend[]> {
  try {
    // Get all interactions during this week
    const interactions = await database
      .get<InteractionModel>('interactions')
      .query(
        Q.where('interaction_date', Q.gte(reflection.weekStartDate)),
        Q.where('interaction_date', Q.lte(reflection.weekEndDate)),
        Q.where('status', 'completed')
      )
      .fetch();

    if (interactions.length === 0) return [];

    // Get friend links for these interactions
    const interactionIds = interactions.map(i => i.id);
    const friendLinks = await database
      .get<InteractionFriend>('interaction_friends')
      .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
      .fetch();

    // Count interactions per friend
    const friendCounts = new Map<string, number>();
    friendLinks.forEach(link => {
      friendCounts.set(link.friendId, (friendCounts.get(link.friendId) || 0) + 1);
    });

    // Fetch friend models
    const friendIds = Array.from(friendCounts.keys());
    const friends = await Promise.all(
      friendIds.map(async (friendId) => {
        try {
          const friend = await database.get<FriendModel>('friends').find(friendId);
          return {
            friend,
            interactionCount: friendCounts.get(friendId) || 0,
          };
        } catch {
          return null;
        }
      })
    );

    // Filter out nulls and sort by interaction count
    return friends
      .filter((f): f is ReflectionFriend => f !== null)
      .sort((a, b) => b.interactionCount - a.interactionCount);
  } catch (error) {
    console.error('Error fetching friends for reflection:', error);
    return [];
  }
}

/**
 * Get all unique friends from all reflections (for filtering)
 */
export async function getAllReflectionFriends(): Promise<FriendModel[]> {
  try {
    // Get all reflections
    const reflections = await database
      .get<WeeklyReflection>('weekly_reflections')
      .query()
      .fetch();

    // Collect all friend IDs from all weeks
    const friendIds = new Set<string>();

    for (const reflection of reflections) {
      const interactions = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gte(reflection.weekStartDate)),
          Q.where('interaction_date', Q.lte(reflection.weekEndDate)),
          Q.where('status', 'completed')
        )
        .fetch();

      const interactionIds = interactions.map(i => i.id);
      if (interactionIds.length > 0) {
        const friendLinks = await database
          .get<InteractionFriend>('interaction_friends')
          .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
          .fetch();

        friendLinks.forEach(link => friendIds.add(link.friendId));
      }
    }

    // Fetch all unique friends
    const friends = await Promise.all(
      Array.from(friendIds).map(async (friendId) => {
        try {
          return await database.get<FriendModel>('friends').find(friendId);
        } catch {
          return null;
        }
      })
    );

    return friends
      .filter((f): f is FriendModel => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching all reflection friends:', error);
    return [];
  }
}
