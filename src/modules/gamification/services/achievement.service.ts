// src/modules/gamification/services/achievement.service.ts
import { Achievement } from '../types';
import {
  GlobalAchievement,
  GLOBAL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  getAchievementById,
} from '../constants/achievement-definitions';
import { database } from '@/db';
import UserProgress from '@/db/models/UserProgress';
import AchievementUnlock from '@/db/models/AchievementUnlock';
import Interaction from '@/db/models/Interaction';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

export interface AchievementUnlockData {
  achievement: GlobalAchievement;
  isHidden: boolean;
}

/**
 * Check and award global achievements for the user
 */
export async function checkAndAwardGlobalAchievements(): Promise<AchievementUnlockData[]> {
  const newUnlocks: AchievementUnlockData[] = [];
  const userProgress = await getUserProgress();
  if (!userProgress) return newUnlocks;

  const unlockedIds = new Set(userProgress.globalAchievements);

  for (const achievement of GLOBAL_ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;

    const progress = await achievement.calculateProgress(userProgress);

    if (progress >= achievement.threshold) {
      await awardGlobalAchievement(userProgress, achievement.id);
      newUnlocks.push({ achievement, isHidden: false });
    }
  }

  return newUnlocks;
}

/**
 * Check for hidden achievement triggers based on context
 */
export async function checkHiddenAchievements(
  trigger: HiddenAchievementTrigger
): Promise<AchievementUnlockData[]> {
  const unlocks: AchievementUnlockData[] = [];
  const userProgress = await getUserProgress();
  if (!userProgress) return unlocks;

  const unlockedIds = new Set(userProgress.hiddenAchievements);

  switch (trigger.type) {
    case 'interaction_logged': {
      const { interaction } = trigger;
      const hour = new Date(interaction.interactionDate).getHours();

      if (hour === 2 && !unlockedIds.has('night_owl')) {
        await awardHiddenAchievement(userProgress, 'night_owl');
        const achievement = getAchievementById('night_owl');
        if (achievement) unlocks.push({ achievement, isHidden: true });
      }

      if (interaction.duration === 'Extended' && !unlockedIds.has('marathon_conversation')) {
        await awardHiddenAchievement(userProgress, 'marathon_conversation');
        const achievement = getAchievementById('marathon_conversation');
        if (achievement) unlocks.push({ achievement, isHidden: true });
      }
      break;
    }
    // ... other cases from the original file
  }

  return unlocks;
}

// ... all other helper functions from the original file

async function getUserProgress(): Promise<UserProgress | null> {
  const records = await database.get<UserProgress>('user_progress').query().fetch();
  return records.length > 0 ? records[0] : null;
}

async function awardGlobalAchievement(
  userProgress: UserProgress,
  achievementId: string
): Promise<void> {
  await database.write(async () => {
    // 1. Update UserProgress
    await userProgress.update(p => {
      const current = p.globalAchievements || [];
      if (!current.includes(achievementId)) {
        p.globalAchievements = [...current, achievementId];
      }
    });

    // 2. Create Unlock Record
    await database.get<AchievementUnlock>('achievement_unlocks').create(unlock => {
      unlock.achievementId = achievementId;
      unlock.achievementType = 'global';
      unlock.unlockedAt = new Date();
      unlock.hasBeenCelebrated = false;
    });
  });
}

async function awardHiddenAchievement(
  userProgress: UserProgress,
  achievementId: string
): Promise<void> {
  await database.write(async () => {
    // 1. Update UserProgress
    await userProgress.update(p => {
      const current = p.hiddenAchievements || [];
      if (!current.includes(achievementId)) {
        p.hiddenAchievements = [...current, achievementId];
      }
    });

    // 2. Create Unlock Record
    await database.get<AchievementUnlock>('achievement_unlocks').create(unlock => {
      unlock.achievementId = achievementId;
      unlock.achievementType = 'hidden';
      unlock.unlockedAt = new Date();
      unlock.hasBeenCelebrated = false;
    });
  });
}

export async function markAchievementAsCelebrated(achievementId: string): Promise<void> {
  const userProgress = await getUserProgress();
  if (!userProgress) return;

  // This is a placeholder. In a real implementation, we would update a 'celebrated_achievements' field
  // or similar. For now, we'll just log it or assume it's handled by the UI state if not persisted.
  // If persistence is needed, we should add a field to UserProgress.
  console.log(`Marked achievement ${achievementId} as celebrated`);
}

export type HiddenAchievementTrigger =
  | { type: 'interaction_logged'; interaction: Interaction }
  | { type: 'interaction_type_used' }
  | { type: 'perfect_week' }
  | { type: 'dormant_rekindled' }
  | { type: 'planned_weave_completed' }
  | { type: 'app_anniversary' };
