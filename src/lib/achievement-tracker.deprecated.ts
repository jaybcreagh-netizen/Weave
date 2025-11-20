/**
 * Achievement Tracker
 *
 * Checks for and awards global achievements across the entire weave
 * Handles progressive achievements (weaving, consistency, depth, social) and hidden achievements
 */

import { database } from '../db';
import AchievementUnlock from '../db/models/AchievementUnlock';
import UserProgress from '../db/models/UserProgress';
import Interaction from '../db/models/Interaction';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import {
  GlobalAchievement,
  GLOBAL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  getAchievementById,
} from './achievement-definitions';

export interface AchievementUnlockData {
  achievement: GlobalAchievement;
  isHidden: boolean;
}

/**
 * Check and award global achievements for the user
 * Call this after any significant action (weave logged, streak extended, etc.)
 */
export async function checkAndAwardGlobalAchievements(): Promise<AchievementUnlockData[]> {
  const newUnlocks: AchievementUnlockData[] = [];

  // Get user progress
  const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
  if (userProgressRecords.length === 0) return newUnlocks;
  const userProgress = userProgressRecords[0];

  // Get currently unlocked achievement IDs
  const unlockedIds = new Set(userProgress.globalAchievements);

  // Check each global achievement
  for (const achievement of GLOBAL_ACHIEVEMENTS) {
    // Skip if already unlocked
    if (unlockedIds.has(achievement.id)) continue;

    // Calculate current progress
    const progress = await achievement.calculateProgress(userProgress);

    // Check if threshold reached
    if (progress >= achievement.threshold) {
      // Award the achievement!
      await awardGlobalAchievement(userProgress, achievement.id);

      newUnlocks.push({
        achievement,
        isHidden: false,
      });
    }
  }

  return newUnlocks;
}

/**
 * Check for hidden achievement triggers based on context
 * Call this when specific actions occur
 */
export async function checkHiddenAchievements(
  trigger: HiddenAchievementTrigger
): Promise<AchievementUnlockData[]> {
  const unlocks: AchievementUnlockData[] = [];

  // Get user progress
  const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
  if (userProgressRecords.length === 0) return unlocks;
  const userProgress = userProgressRecords[0];

  // Get currently unlocked hidden achievement IDs
  const unlockedIds = new Set(userProgress.hiddenAchievements);

  switch (trigger.type) {
    case 'interaction_logged': {
      const { interaction } = trigger;
      const interactionDate = new Date(interaction.interactionDate);
      const hour = interactionDate.getHours();

      // Night Owl (2am weave)
      if (hour === 2 && !unlockedIds.has('night_owl')) {
        await awardHiddenAchievement(userProgress, 'night_owl');
        const achievement = getAchievementById('night_owl');
        if (achievement) {
          unlocks.push({ achievement, isHidden: true });
        }
      }

      // Marathon Conversation (4+ hours)
      if (interaction.duration === 'Extended' && !unlockedIds.has('marathon_conversation')) {
        // Consider 'Extended' as 4+ hours
        await awardHiddenAchievement(userProgress, 'marathon_conversation');
        const achievement = getAchievementById('marathon_conversation');
        if (achievement) {
          unlocks.push({ achievement, isHidden: true });
        }
      }

      break;
    }

    case 'interaction_type_used': {
      // Renaissance Soul (use every interaction type at least once)
      if (!unlockedIds.has('renaissance_soul')) {
        const uniqueTypes = await getUniqueInteractionTypes();
        if (uniqueTypes >= 20) {
          // Assuming 20+ interaction types in the system
          await awardHiddenAchievement(userProgress, 'renaissance_soul');
          const achievement = getAchievementById('renaissance_soul');
          if (achievement) {
            unlocks.push({ achievement, isHidden: true });
          }
        }
      }
      break;
    }

    case 'perfect_week': {
      // Perfect Week (contacted every friend in 7 days)
      if (!unlockedIds.has('perfect_week')) {
        const isPerfect = await checkPerfectWeek();
        if (isPerfect) {
          await awardHiddenAchievement(userProgress, 'perfect_week');
          const achievement = getAchievementById('perfect_week');
          if (achievement) {
            unlocks.push({ achievement, isHidden: true });
          }
        }
      }
      break;
    }

    case 'dormant_rekindled': {
      // Rekindle Master (restore 3 dormant friendships)
      if (!unlockedIds.has('rekindle_master')) {
        const rekindleCount = await getRekindledCount();
        if (rekindleCount >= 3) {
          await awardHiddenAchievement(userProgress, 'rekindle_master');
          const achievement = getAchievementById('rekindle_master');
          if (achievement) {
            unlocks.push({ achievement, isHidden: true });
          }
        }
      }
      break;
    }

    case 'planned_weave_completed': {
      // Planning Prodigy (complete 10 planned weaves on time)
      if (!unlockedIds.has('planning_prodigy')) {
        const plannedCount = await getCompletedPlannedWeaveCount();
        if (plannedCount >= 10) {
          await awardHiddenAchievement(userProgress, 'planning_prodigy');
          const achievement = getAchievementById('planning_prodigy');
          if (achievement) {
            unlocks.push({ achievement, isHidden: true });
          }
        }
      }
      break;
    }

    case 'app_anniversary': {
      // Year of Connection (1 year anniversary with app)
      if (!unlockedIds.has('year_of_connection')) {
        await awardHiddenAchievement(userProgress, 'year_of_connection');
        const achievement = getAchievementById('year_of_connection');
        if (achievement) {
          unlocks.push({ achievement, isHidden: true });
        }
      }
      break;
    }
  }

  return unlocks;
}

// ============================================================================
// TRIGGER TYPES
// ============================================================================

export type HiddenAchievementTrigger =
  | { type: 'interaction_logged'; interaction: Interaction }
  | { type: 'interaction_type_used' }
  | { type: 'perfect_week' }
  | { type: 'dormant_rekindled' }
  | { type: 'planned_weave_completed' }
  | { type: 'app_anniversary' };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Award a global achievement to the user
 */
async function awardGlobalAchievement(
  userProgress: UserProgress,
  achievementId: string
): Promise<void> {
  const achievement = getAchievementById(achievementId);
  if (!achievement) return;

  await database.write(async () => {
    // Update user progress
    await userProgress.update(up => {
      const current = up.globalAchievements || [];
      if (!current.includes(achievementId)) {
        up.globalAchievements = [...current, achievementId];
      }
    });

    // Create achievement unlock record for celebration queue
    await database.get<AchievementUnlock>('achievement_unlocks').create(unlock => {
      unlock.achievementId = achievementId;
      unlock.achievementType = 'global';
      unlock.relatedFriendId = undefined;
      unlock.unlockedAt = new Date();
      unlock.hasBeenCelebrated = false; // Will trigger unlock modal
    });
  });
}

/**
 * Award a hidden achievement to the user
 */
async function awardHiddenAchievement(
  userProgress: UserProgress,
  achievementId: string
): Promise<void> {
  const achievement = getAchievementById(achievementId);
  if (!achievement) return;

  await database.write(async () => {
    // Update user progress
    await userProgress.update(up => {
      const current = up.hiddenAchievements || [];
      if (!current.includes(achievementId)) {
        up.hiddenAchievements = [...current, achievementId];
      }
    });

    // Create achievement unlock record for celebration queue
    await database.get<AchievementUnlock>('achievement_unlocks').create(unlock => {
      unlock.achievementId = achievementId;
      unlock.achievementType = 'hidden';
      unlock.relatedFriendId = undefined;
      unlock.unlockedAt = new Date();
      unlock.hasBeenCelebrated = false; // Will trigger unlock modal
    });
  });
}

/**
 * Get all uncelebrated global/hidden achievement unlocks
 * Used to queue unlock modals on app startup
 */
export async function getUncelebratedAchievementUnlocks(): Promise<AchievementUnlockData[]> {
  const unlocks = await database
    .get<AchievementUnlock>('achievement_unlocks')
    .query(
      Q.where('achievement_type', Q.oneOf(['global', 'hidden'])),
      Q.where('has_been_celebrated', false),
      Q.sortBy('unlocked_at', 'asc')
    )
    .fetch();

  const achievementUnlocks: AchievementUnlockData[] = [];

  for (const unlock of unlocks) {
    const achievement = getAchievementById(unlock.achievementId);
    if (!achievement) continue;

    achievementUnlocks.push({
      achievement,
      isHidden: unlock.achievementType === 'hidden',
    });
  }

  return achievementUnlocks;
}

/**
 * Mark an achievement unlock as celebrated
 */
export async function markAchievementAsCelebrated(achievementId: string): Promise<void> {
  const unlocks = await database
    .get<AchievementUnlock>('achievement_unlocks')
    .query(
      Q.where('achievement_id', achievementId),
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

/**
 * Check if user has achieved a perfect week (contacted every friend in 7 days)
 */
async function checkPerfectWeek(): Promise<boolean> {
  const friends = await database.get<Friend>('friends').query(Q.where('is_dormant', false)).fetch();
  if (friends.length === 0) return false;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Check if each friend has at least one interaction in the last 7 days
  for (const friend of friends) {
    const recentInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(sevenDaysAgo.getTime())),
        Q.on('interaction_friends', 'friend_id', friend.id)
      )
      .fetch();

    if (recentInteractions.length === 0) {
      return false; // Friend not contacted in last 7 days
    }
  }

  return true;
}

/**
 * Get count of unique interaction types used
 */
async function getUniqueInteractionTypes(): Promise<number> {
  const interactions = await database
    .get<Interaction>('interactions')
    .query(Q.where('status', 'completed'))
    .fetch();

  const uniqueTypes = new Set(interactions.map(i => i.interactionType));
  return uniqueTypes.size;
}

/**
 * Get count of rekindled dormant friendships
 * (Count friends that were marked dormant and then had isDormant set back to false)
 */
async function getRekindledCount(): Promise<number> {
  // This is a simplified implementation
  // In a real implementation, you'd track dormancy state changes in a separate table
  // For now, we'll count friends that have phoenix_rising badge
  const phoenixBadges = await database
    .get<AchievementUnlock>('achievement_unlocks')
    .query(
      Q.where('achievement_id', 'phoenix_rising'),
      Q.where('achievement_type', 'friend_badge')
    )
    .fetch();

  return phoenixBadges.length;
}

/**
 * Get count of completed planned weaves
 */
async function getCompletedPlannedWeaveCount(): Promise<number> {
  // Count interactions that were status 'planned' and then moved to 'completed'
  // For now, this is a placeholder - would need tracking of status transitions
  const plannedInteractions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed')
      // Would need a 'was_planned' field to track this properly
    )
    .fetch();

  // For now, return 0 - this would need additional tracking
  return 0;
}

/**
 * Check if user has been using the app for 1 year
 */
export async function checkAppAnniversary(): Promise<boolean> {
  const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
  if (userProgressRecords.length === 0) return false;

  const userProgress = userProgressRecords[0];
  const firstWeaveDate = userProgress.createdAt;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return firstWeaveDate <= oneYearAgo;
}
