/**
 * Notification Grace Periods
 * Prevents overwhelming new users with notifications before they've had
 * a chance to explore and use the app.
 */

import { differenceInDays, differenceInHours } from 'date-fns';
import { database } from '../db';
import UserProfile from '../db/models/UserProfile';
import InteractionModel from '../db/models/Interaction';
import FriendModel from '../db/models/Friend';

/**
 * Grace period configuration for different notification types
 */
export const GRACE_PERIODS = {
  // Weekly reflection: Wait at least 7 days and 1 interaction
  weeklyReflection: {
    minDaysOld: 7,
    minInteractions: 1,
  },

  // Social battery: Wait 48 hours and 3 interactions
  socialBattery: {
    minHoursOld: 48,
    minInteractions: 3,
  },

  // Ambient logging: Wait 3 days and 2 friends
  ambientLogging: {
    minDaysOld: 3,
    minFriends: 2,
  },

  // General suggestions/nudges: Wait at least 24 hours
  general: {
    minHoursOld: 24,
  },
} as const;

/**
 * Get user profile creation date
 */
async function getUserCreatedAt(): Promise<Date | null> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();
    if (profiles.length === 0) return null;
    return profiles[0].createdAt;
  } catch (error) {
    console.error('[GracePeriod] Error getting user created date:', error);
    return null;
  }
}

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

/**
 * Check if weekly reflection notification should be sent
 */
export async function shouldSendWeeklyReflectionNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const userCreatedAt = await getUserCreatedAt();

  if (!userCreatedAt) {
    return { shouldSend: false, reason: 'User profile not found' };
  }

  const daysOld = differenceInDays(new Date(), userCreatedAt);

  if (daysOld < GRACE_PERIODS.weeklyReflection.minDaysOld) {
    return {
      shouldSend: false,
      reason: `User account is only ${daysOld} days old (need ${GRACE_PERIODS.weeklyReflection.minDaysOld})`,
    };
  }

  const interactionCount = await getInteractionCount();

  if (interactionCount < GRACE_PERIODS.weeklyReflection.minInteractions) {
    return {
      shouldSend: false,
      reason: `User has only ${interactionCount} interactions (need ${GRACE_PERIODS.weeklyReflection.minInteractions})`,
    };
  }

  return { shouldSend: true };
}

/**
 * Check if social battery notification should be sent
 */
export async function shouldSendSocialBatteryNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const userCreatedAt = await getUserCreatedAt();

  if (!userCreatedAt) {
    return { shouldSend: false, reason: 'User profile not found' };
  }

  const hoursOld = differenceInHours(new Date(), userCreatedAt);

  if (hoursOld < GRACE_PERIODS.socialBattery.minHoursOld) {
    return {
      shouldSend: false,
      reason: `User account is only ${hoursOld} hours old (need ${GRACE_PERIODS.socialBattery.minHoursOld})`,
    };
  }

  const interactionCount = await getInteractionCount();

  if (interactionCount < GRACE_PERIODS.socialBattery.minInteractions) {
    return {
      shouldSend: false,
      reason: `User has only ${interactionCount} interactions (need ${GRACE_PERIODS.socialBattery.minInteractions})`,
    };
  }

  return { shouldSend: true };
}

/**
 * Check if ambient logging notification should be sent
 */
export async function shouldSendAmbientLoggingNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const userCreatedAt = await getUserCreatedAt();

  if (!userCreatedAt) {
    return { shouldSend: false, reason: 'User profile not found' };
  }

  const daysOld = differenceInDays(new Date(), userCreatedAt);

  if (daysOld < GRACE_PERIODS.ambientLogging.minDaysOld) {
    return {
      shouldSend: false,
      reason: `User account is only ${daysOld} days old (need ${GRACE_PERIODS.ambientLogging.minDaysOld})`,
    };
  }

  const friendCount = await getFriendCount();

  if (friendCount < GRACE_PERIODS.ambientLogging.minFriends) {
    return {
      shouldSend: false,
      reason: `User has only ${friendCount} friends (need ${GRACE_PERIODS.ambientLogging.minFriends})`,
    };
  }

  return { shouldSend: true };
}

/**
 * Check if general notification should be sent
 */
export async function shouldSendGeneralNotification(): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  const userCreatedAt = await getUserCreatedAt();

  if (!userCreatedAt) {
    return { shouldSend: false, reason: 'User profile not found' };
  }

  const hoursOld = differenceInHours(new Date(), userCreatedAt);

  if (hoursOld < GRACE_PERIODS.general.minHoursOld) {
    return {
      shouldSend: false,
      reason: `User account is only ${hoursOld} hours old (need ${GRACE_PERIODS.general.minHoursOld})`,
    };
  }

  return { shouldSend: true };
}

/**
 * Get user account age in days
 */
export async function getUserAccountAge(): Promise<number | null> {
  const userCreatedAt = await getUserCreatedAt();
  if (!userCreatedAt) return null;
  return differenceInDays(new Date(), userCreatedAt);
}
