/**
 * Badge Calculator
 *
 * Calculates current badge progress for friends
 * Determines which badges are unlocked and progress toward next tier
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendBadge from '@/db/models/FriendBadge';
import Interaction from '@/db/models/Interaction';
import {
  FRIEND_BADGE_CATEGORIES,
  BadgeDefinition,
  getBadgeById,
  getNextBadgeInCategory,
} from '../constants/badge-definitions';
import { differenceInMonths, startOfMonth } from 'date-fns';

export interface BadgeProgress {
  categoryType: string;
  currentTier: number;
  currentBadge: BadgeDefinition | null;
  nextBadge: BadgeDefinition | null;
  progress: number; // Current value (e.g., weave count)
  progressPercent: number; // Percentage to next badge
}

/**
 * Calculate current badge progress for a friend across all categories
 */
export async function calculateFriendBadgeProgress(friendId: string): Promise<BadgeProgress[]> {
  const progressList: BadgeProgress[] = [];

  // Get all unlocked badges for this friend
  const unlockedBadges = await database
    .get<FriendBadge>('friend_badges')
    .query(Q.where('friend_id', friendId))
    .fetch();

  // Calculate progress for each category
  for (const category of FRIEND_BADGE_CATEGORIES) {
    const categoryBadges = unlockedBadges.filter(b => b.badgeType === category.type);
    const currentTier = Math.max(0, ...categoryBadges.map(b => b.tier));
    const currentBadge = category.badges.find(b => b.tier === currentTier) || null;
    const nextBadge = category.badges.find(b => b.tier === currentTier + 1) || null;

    // Calculate current progress value
    let progress = 0;

    switch (category.type) {
      case 'weave_count':
        progress = await getWeaveCount(friendId);
        break;
      case 'depth':
        progress = await getReflectionCount(friendId);
        break;
      case 'consistency':
        progress = await getConsecutiveContactMonths(friendId);
        break;
      case 'special':
        // Special badges are event-based, not progressive
        progress = categoryBadges.length;
        break;
    }

    const progressPercent = nextBadge
      ? Math.min(100, (progress / nextBadge.threshold) * 100)
      : 100;

    progressList.push({
      categoryType: category.type,
      currentTier,
      currentBadge,
      nextBadge,
      progress,
      progressPercent,
    });
  }

  return progressList;
}

/**
 * Get weave count for a friend
 */
async function getWeaveCount(friendId: string): Promise<number> {
  // 1. Get interaction IDs from join table
  const links = await database
    .get('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();
  const interactionIds = links.map((link: any) => link.interactionId);

  if (interactionIds.length === 0) return 0;

  // 2. Count interactions with those IDs
  const count = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('id', Q.oneOf(interactionIds))
    )
    .fetchCount();

  return count;
}

/**
 * Get reflection count for a friend
 */
async function getReflectionCount(friendId: string): Promise<number> {
  // 1. Get interaction IDs from join table
  const links = await database
    .get('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();
  const interactionIds = links.map((link: any) => link.interactionId);

  if (interactionIds.length === 0) return 0;

  // 2. Fetch interactions
  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('id', Q.oneOf(interactionIds))
    )
    .fetch();

  // Count interactions with reflections
  return interactions.filter(i => {
    if (!i.reflection) return false;
    try {
      const reflection = typeof i.reflection === 'string' ? JSON.parse(i.reflection) : i.reflection;
      return (
        (reflection.chips && reflection.chips.length > 0) ||
        (reflection.customNotes && reflection.customNotes.trim().length > 0)
      );
    } catch (e) {
      return false;
    }
  }).length;
}

/**
 * Get consecutive contact months for a friend
 * Counts how many consecutive months (from current month backward) the friend was contacted
 */
async function getConsecutiveContactMonths(friendId: string): Promise<number> {
  // 1. Get interaction IDs from join table
  const links = await database
    .get('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .fetch();
  const interactionIds = links.map((link: any) => link.interactionId);

  if (interactionIds.length === 0) return 0;

  // 2. Fetch interactions
  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('id', Q.oneOf(interactionIds)),
      Q.sortBy('interaction_date', 'desc')
    )
    .fetch();

  if (interactions.length === 0) return 0;

  // Group interactions by month
  const monthsContacted = new Set<string>();
  interactions.forEach(i => {
    const date = new Date(i.interactionDate);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    monthsContacted.add(monthKey);
  });

  // Count consecutive months from current month backward
  let streak = 0;
  const today = new Date();
  let checkDate = startOfMonth(today);

  // Check current month and previous months
  for (let i = 0; i < 12; i++) {
    // Max 12 months check
    const monthKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
    if (!monthsContacted.has(monthKey)) {
      break; // Streak broken
    }
    streak++;
    checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() - 1, 1);
  }

  return streak;
}

/**
 * Get highest badge earned in a category
 */
export async function getHighestBadgeInCategory(
  friendId: string,
  categoryType: string
): Promise<BadgeDefinition | null> {
  const badges = await database
    .get<FriendBadge>('friend_badges')
    .query(
      Q.where('friend_id', friendId),
      Q.where('badge_type', categoryType)
    )
    .fetch();

  if (badges.length === 0) return null;

  const highestTier = Math.max(...badges.map(b => b.tier));
  const highestBadgeId = badges.find(b => b.tier === highestTier)?.badgeId;

  return highestBadgeId ? getBadgeById(highestBadgeId) : null;
}

/**
 * Get all unlocked badges for a friend
 */
export async function getUnlockedBadges(friendId: string): Promise<FriendBadge[]> {
  return await database
    .get<FriendBadge>('friend_badges')
    .query(Q.where('friend_id', friendId))
    .fetch();
}

/**
 * Check if a specific badge is unlocked
 */
export async function isBadgeUnlocked(
  friendId: string,
  badgeId: string
): Promise<boolean> {
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
 * Get badge count for a friend
 */
export async function getBadgeCount(friendId: string): Promise<number> {
  return await database
    .get<FriendBadge>('friend_badges')
    .query(Q.where('friend_id', friendId))
    .fetchCount();
}
