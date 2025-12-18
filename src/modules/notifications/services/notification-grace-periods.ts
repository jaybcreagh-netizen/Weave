/**
 * Notification Grace Periods
 * Prevents overwhelming new users with notifications before they've had
 * a chance to explore and use the app.
 */

import { database } from '@/db';
import InteractionModel from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';

/**
 * Grace period configuration for different notification types
 */
export const GRACE_PERIODS = {
  // Weekly reflection: 3 interactions minimum
  weeklyReflection: {
    minInteractions: 3,
  },

  // Social battery: 3 interactions minimum
  socialBattery: {
    minInteractions: 3,
  },

  // Ambient logging: 2 friends minimum
  ambientLogging: {
    minFriends: 2,
  },

  // General suggestions/nudges: 1 interaction minimum
  general: {
    minInteractions: 1,
  },
} as const;

/**
 * Get count of completed interactions
 */
async function getInteractionCount(): Promise<number> {
  try {
    const interactions = await database
      .get<InteractionModel>('interactions')
      .query()
      .fetch();
    return interactions.filter(i => i.status === 'completed').length;
  } catch (error) {
    console.error('[GracePeriod] Error getting interaction count:', error);
    return 0;
  }
}

/**
 * Get count of friends
 */
async function getFriendCount(): Promise<number> {
  try {
    const friends = await database.get<FriendModel>('friends').query().fetch();
    return friends.length;
  } catch (error) {
    console.error('[GracePeriod] Error getting friend count:', error);
    return 0;
  }
}

export async function shouldSendWeeklyReflectionNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const interactionCount = await getInteractionCount();

  if (interactionCount < GRACE_PERIODS.weeklyReflection.minInteractions) {
    return {
      shouldSend: false,
      reason: `User has only ${interactionCount} interactions (need ${GRACE_PERIODS.weeklyReflection.minInteractions})`,
    };
  }

  return { shouldSend: true };
}

export async function shouldSendSocialBatteryNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const interactionCount = await getInteractionCount();

  if (interactionCount < GRACE_PERIODS.socialBattery.minInteractions) {
    return {
      shouldSend: false,
      reason: `User has only ${interactionCount} interactions (need ${GRACE_PERIODS.socialBattery.minInteractions})`,
    };
  }

  return { shouldSend: true };
}

export async function shouldSendAmbientLoggingNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const friendCount = await getFriendCount();

  if (friendCount < GRACE_PERIODS.ambientLogging.minFriends) {
    return {
      shouldSend: false,
      reason: `User has only ${friendCount} friends (need ${GRACE_PERIODS.ambientLogging.minFriends})`,
    };
  }

  return { shouldSend: true };
}

export async function shouldSendGeneralNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const interactionCount = await getInteractionCount();

  if (interactionCount < GRACE_PERIODS.general.minInteractions) {
    return {
      shouldSend: false,
      reason: `User has only ${interactionCount} interactions (need ${GRACE_PERIODS.general.minInteractions})`,
    };
  }

  return { shouldSend: true };
}
