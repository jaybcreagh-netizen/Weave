/**
 * Badge Tracker
 *
 * Checks for and awards friend badges when milestones are reached
 * Handles progressive badges (weave count, depth, consistency) and event-based special badges
 */

import { database } from '../db';
import FriendBadge from '../db/models/FriendBadge';
import AchievementUnlock from '../db/models/AchievementUnlock';
import Interaction from '../db/models/Interaction';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { BadgeDefinition, getBadgeById } from './badge-definitions';
import { calculateFriendBadgeProgress } from './badge-calculator';

export interface BadgeUnlock {
  badge: BadgeDefinition;
  categoryType: string;
  friendId: string;
  friendName: string;
}

/**
 * Check and award progressive badges for a friend (weave_count, depth, consistency)
 * Call this after any interaction is logged/updated
 */
export async function checkAndAwardFriendBadges(
  friendId: string,
  friendName: string
): Promise<BadgeUnlock[]> {
  const newUnlocks: BadgeUnlock[] = [];

  // Get current progress
  const progressList = await calculateFriendBadgeProgress(friendId);

  for (const progress of progressList) {
    // Skip special badges (they're event-based, not progressive)
    if (progress.categoryType === 'special') continue;

    // Check if we've reached the threshold for the next badge
    if (progress.nextBadge && progress.progress >= progress.nextBadge.threshold) {
      // Check if already unlocked
      const existing = await database
        .get<FriendBadge>('friend_badges')
        .query(
          Q.where('friend_id', friendId),
          Q.where('badge_id', progress.nextBadge.id)
        )
        .fetch();

      if (existing.length === 0) {
        // Award the badge!
        await awardBadge(friendId, progress.categoryType, progress.nextBadge.id);

        newUnlocks.push({
          badge: progress.nextBadge,
          categoryType: progress.categoryType,
          friendId,
          friendName,
        });
      }
    }
  }

  return newUnlocks;
}

/**
 * Check for special badge triggers based on interaction context
 * Call this when logging a new interaction
 */
export async function checkSpecialBadges(
  friendId: string,
  friendName: string,
  interaction: Interaction
): Promise<BadgeUnlock[]> {
  const unlocks: BadgeUnlock[] = [];

  // First Connection (automatically awarded on first interaction)
  if (await isFirstWeave(friendId)) {
    await awardSpecialBadge(friendId, 'first_connection');
    const badge = getBadgeById('first_connection');
    if (badge) {
      unlocks.push({
        badge,
        categoryType: 'special',
        friendId,
        friendName,
      });
    }
  }

  const friend = await database.get<Friend>('friends').find(friendId);

  // Birthday Celebrated
  if (friend.birthday) {
    const interactionDate = new Date(interaction.interactionDate);

    // Birthday is now in "MM-DD" format
    const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));

    if (
      interactionDate.getMonth() === month - 1 && // JavaScript months are 0-indexed
      interactionDate.getDate() === day &&
      !(await isBadgeUnlocked(friendId, 'birthday_celebrated'))
    ) {
      await awardSpecialBadge(friendId, 'birthday_celebrated');
      const badge = getBadgeById('birthday_celebrated');
      if (badge) {
        unlocks.push({
          badge,
          categoryType: 'special',
          friendId,
          friendName,
        });
      }
    }
  }

  // Anniversary Keeper
  if (friend.anniversary) {
    const interactionDate = new Date(interaction.interactionDate);
    const anniversaryDate = new Date(friend.anniversary);

    if (
      interactionDate.getMonth() === anniversaryDate.getMonth() &&
      interactionDate.getDate() === anniversaryDate.getDate() &&
      !(await isBadgeUnlocked(friendId, 'anniversary_keeper'))
    ) {
      await awardSpecialBadge(friendId, 'anniversary_keeper');
      const badge = getBadgeById('anniversary_keeper');
      if (badge) {
        unlocks.push({
          badge,
          categoryType: 'special',
          friendId,
          friendName,
        });
      }
    }
  }

  // Peak Moment (first highly positive interaction)
  if (
    (interaction.vibe === 'FullMoon' || interaction.vibe === 'WaxingGibbous') &&
    !(await isBadgeUnlocked(friendId, 'peak_moment'))
  ) {
    await awardSpecialBadge(friendId, 'peak_moment');
    const badge = getBadgeById('peak_moment');
    if (badge) {
      unlocks.push({
        badge,
        categoryType: 'special',
        friendId,
        friendName,
      });
    }
  }

  // Phoenix Rising (rekindled dormant friendship)
  if (friend.isDormant && !(await isBadgeUnlocked(friendId, 'phoenix_rising'))) {
    // Mark friend as no longer dormant
    await database.write(async () => {
      await friend.update(f => {
        f.isDormant = false;
        f.dormantSince = null;
      });
    });

    await awardSpecialBadge(friendId, 'phoenix_rising');
    const badge = getBadgeById('phoenix_rising');
    if (badge) {
      unlocks.push({
        badge,
        categoryType: 'special',
        friendId,
        friendName,
      });
    }
  }

  return unlocks;
}

/**
 * Award a badge to a friend
 */
async function awardBadge(
  friendId: string,
  badgeType: string,
  badgeId: string
): Promise<void> {
  const badge = getBadgeById(badgeId);
  if (!badge) return;

  await database.write(async () => {
    // Create friend badge record
    await database.get<FriendBadge>('friend_badges').create(b => {
      b.friendId = friendId;
      b.badgeType = badgeType;
      b.badgeId = badgeId;
      b.tier = badge.tier;
      b.unlockedAt = new Date();
    });

    // Create achievement unlock record for celebration queue
    await database.get<AchievementUnlock>('achievement_unlocks').create(unlock => {
      unlock.achievementId = badgeId;
      unlock.achievementType = 'friend_badge';
      unlock.relatedFriendId = friendId;
      unlock.unlockedAt = new Date();
      unlock.hasBeenCelebrated = false; // Will trigger unlock modal
    });
  });
}

/**
 * Award a special badge to a friend
 */
async function awardSpecialBadge(friendId: string, badgeId: string): Promise<void> {
  await awardBadge(friendId, 'special', badgeId);
}

/**
 * Check if this is the first weave with a friend
 */
async function isFirstWeave(friendId: string): Promise<boolean> {
  const count = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.on('interaction_friends', 'friend_id', friendId)
    )
    .fetchCount();

  return count === 1;
}

/**
 * Check if a badge is already unlocked
 */
async function isBadgeUnlocked(friendId: string, badgeId: string): Promise<boolean> {
  const count = await database
    .get<FriendBadge>('friend_badges')
    .query(
      Q.where('friend_id', friendId),
      Q.where('badge_id', badgeId)
    )
    .fetchCount();

  return count > 0;
}

/**
 * Get all unlocks that haven't been celebrated yet
 * Used to queue unlock modals on app startup
 */
export async function getUncelebratedBadgeUnlocks(): Promise<BadgeUnlock[]> {
  const unlocks = await database
    .get<AchievementUnlock>('achievement_unlocks')
    .query(
      Q.where('achievement_type', 'friend_badge'),
      Q.where('has_been_celebrated', false),
      Q.sortBy('unlocked_at', 'asc')
    )
    .fetch();

  const badgeUnlocks: BadgeUnlock[] = [];

  for (const unlock of unlocks) {
    const badge = getBadgeById(unlock.achievementId);
    if (!badge || !unlock.relatedFriendId) continue;

    const friend = await database.get<Friend>('friends').find(unlock.relatedFriendId);

    badgeUnlocks.push({
      badge,
      categoryType: 'friend_badge', // We'll determine from badge ID if needed
      friendId: unlock.relatedFriendId,
      friendName: friend.name,
    });
  }

  return badgeUnlocks;
}

/**
 * Mark a badge unlock as celebrated
 */
export async function markBadgeAsCelebrated(badgeId: string, friendId: string): Promise<void> {
  const unlocks = await database
    .get<AchievementUnlock>('achievement_unlocks')
    .query(
      Q.where('achievement_id', badgeId),
      Q.where('related_friend_id', friendId),
      Q.where('has_been_celebrated', false)
    )
    .fetch();

  if (unlocks.length > 0) {
    await database.write(async () => {
      for (const unlock of unlocks) {
        await unlock.update(u => {
          u.hasBeenCelebrated = true;
        });
      }
    });
  }
}
