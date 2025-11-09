import { Database } from '@nozbe/watermelondb';
import { Friend, Interaction, Tier, Archetype, InteractionType, InteractionCategory, Duration, Vibe } from '../components/types';
import { TierDecayRates, InteractionBaseScores, CategoryBaseScores, DurationModifiers, VibeMultipliers, RecencyFactors, ArchetypeMatrixV2, CategoryArchetypeMatrix } from './constants';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import UserProgress from '../db/models/UserProgress';
import { type InteractionFormData } from '../stores/interactionStore';
import { checkAndAwardFriendBadges, checkSpecialBadges, BadgeUnlock } from './badge-tracker';
import { checkAndAwardGlobalAchievements, checkHiddenAchievements, AchievementUnlockData } from './achievement-tracker';

/**
 * Calculates the decayed score of a friend based on the time since the last update.
 */
export function calculateCurrentScore(friend: FriendModel): number {
  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
  const decayAmount = (daysSinceLastUpdate * tierDecayRate) / friend.resilience;
  return Math.max(0, friend.weaveScore - decayAmount);
}

/**
 * Calculates the points for a new interaction.
 * Supports both old activity-based and new category-based systems.
 */
export function calculatePointsForWeave(
  friend: FriendModel,
  weaveData: {
    interactionType?: InteractionType;
    category?: InteractionCategory;
    duration: Duration | null;
    vibe: Vibe | null
  }
): number {
  // Calculate current momentum
  const daysSinceMomentumUpdate = (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
  const currentMomentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

  let baseScore: number;
  let archetypeMultiplier: number;

  // NEW: Use category-based scoring if available
  if (weaveData.category) {
    baseScore = CategoryBaseScores[weaveData.category];
    archetypeMultiplier = CategoryArchetypeMatrix[friend.archetype as Archetype][weaveData.category];
  }
  // DEPRECATED: Fall back to old activity-based scoring
  else if (weaveData.interactionType) {
    baseScore = InteractionBaseScores[weaveData.interactionType];
    archetypeMultiplier = ArchetypeMatrixV2[friend.archetype as Archetype][weaveData.interactionType];
  }
  // Default fallback
  else {
    baseScore = 15;
    archetypeMultiplier = 1.0;
  }

  const durationModifier = DurationModifiers[weaveData.duration || 'Standard'];
  const vibeMultiplier = VibeMultipliers[weaveData.vibe || 'WaxingCrescent'];

  const eventMultiplier = 1.0; // Hardcoded for Phase 1
  const groupDilutionFactor = 1.0; // Hardcoded for Phase 1

  const initialPoints = baseScore * archetypeMultiplier * durationModifier;
  const finalPoints = initialPoints * vibeMultiplier * eventMultiplier * groupDilutionFactor;

  // Apply momentum bonus
  if (currentMomentumScore > 0) {
    return finalPoints * 1.15;
  }

  return finalPoints;
}

/**
 * Logs a new interaction, calculates the new scores, and updates the database in a single transaction.
 * Returns the interaction ID and any badge/achievement unlocks.
 */
export async function logNewWeave(
  friendsToUpdate: FriendModel[],
  weaveData: InteractionFormData,
  database: Database
): Promise<{
  interactionId: string;
  badgeUnlocks: BadgeUnlock[];
  achievementUnlocks: AchievementUnlockData[];
}> {
  let interactionId = '';
  let newInteraction: InteractionModel | null = null;

  await database.write(async () => {
    // 1. Create the Interaction record with the correct data
    newInteraction = await database.get<InteractionModel>('interactions').create(interaction => {
      interaction.interactionDate = weaveData.date;
      interaction.interactionType = weaveData.type; // 'log' or 'plan'
      interaction.activity = weaveData.activity;
      interaction.status = weaveData.status;
      interaction.mode = weaveData.mode;
      interaction.note = weaveData.notes;
      interaction.vibe = weaveData.vibe;
      interaction.duration = weaveData.duration;
      // NEW: Save category if provided
      if (weaveData.category) {
        interaction.interactionCategory = weaveData.category;
      }
      // NEW: Save structured reflection if provided
      if (weaveData.reflection) {
        interaction.reflectionJSON = JSON.stringify(weaveData.reflection);
      }
      // v17: Save title and location if provided
      if (weaveData.title) {
        interaction.title = weaveData.title;
      }
      if (weaveData.location) {
        interaction.location = weaveData.location;
      }
    });

    interactionId = newInteraction.id;

    for (const friend of friendsToUpdate) {
      // If the weave is just being planned for the future, don't update scores yet.
      if (weaveData.type === 'plan') {
        // Just create the join record and continue to the next friend.
        await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
            ifriend.interactionId = newInteraction!.id;
            ifriend.friendId = friend.id;
        });
        continue; // Skip all the scoring logic
      }

      // 2. Calculate scores using the relevant part of the weaveData
      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, {
          // NEW: Use category if available, otherwise fall back to old activity
          category: weaveData.category as InteractionCategory | undefined,
          interactionType: weaveData.activity as InteractionType,
          duration: weaveData.duration,
          vibe: weaveData.vibe
      });
      const newWeaveScore = Math.min(100, currentScore + pointsToAdd);

      // 3. Update the friend record with all new scores and states
      await friend.update(record => {
        record.weaveScore = newWeaveScore;
        record.lastUpdated = new Date();

        if (weaveData.vibe) {
          record.ratedWeavesCount += 1;
          if (record.ratedWeavesCount >= 5) {
            let newResilience = record.resilience;
            if (weaveData.vibe === 'WaxingGibbous' || weaveData.vibe === 'FullMoon') {
              newResilience += 0.008;
            } else if (weaveData.vibe === 'NewMoon') {
              newResilience -= 0.005;
            }
            record.resilience = Math.max(0.8, Math.min(1.5, newResilience));
          }
        }

        record.momentumScore = 15;
        record.momentumLastUpdated = new Date();
        record.isDormant = false;
        record.dormantSince = null;
      });

      // 4. Create the join table record
      await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
          ifriend.interactionId = newInteraction!.id;
          ifriend.friendId = friend.id;
      });
    }

    // 5. Update UserProgress total weaves count (only for completed weaves)
    if (weaveData.type === 'log') {
      const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
      if (userProgressRecords.length > 0) {
        const userProgress = userProgressRecords[0];
        await userProgress.update(up => {
          up.totalWeaves = (up.totalWeaves || 0) + 1;
        });
      }
    }
  });

  // 6. Check for badge and achievement unlocks (after transaction completes)
  const allBadgeUnlocks: BadgeUnlock[] = [];
  const allAchievementUnlocks: AchievementUnlockData[] = [];

  if (weaveData.type === 'log' && newInteraction) {
    // Check badges for each friend
    for (const friend of friendsToUpdate) {
      // Check progressive badges (weave_count, depth, consistency)
      const progressiveBadges = await checkAndAwardFriendBadges(friend.id, friend.name);
      allBadgeUnlocks.push(...progressiveBadges);

      // Check special badges (birthday, phoenix rising, time-based, etc.)
      const specialBadges = await checkSpecialBadges(friend.id, friend.name, newInteraction);
      allBadgeUnlocks.push(...specialBadges);
    }

    // Check global achievements
    const globalUnlocks = await checkAndAwardGlobalAchievements();
    allAchievementUnlocks.push(...globalUnlocks);

    // Check hidden achievements
    const hiddenUnlocks = await checkHiddenAchievements({
      type: 'interaction_logged',
      interaction: newInteraction,
    });
    allAchievementUnlocks.push(...hiddenUnlocks);

    // Check for perfect week (if all friends were contacted in last 7 days)
    // This is an expensive check, so we only do it occasionally
    if (Math.random() < 0.1) {
      // 10% chance to check
      const perfectWeekUnlocks = await checkHiddenAchievements({ type: 'perfect_week' });
      allAchievementUnlocks.push(...perfectWeekUnlocks);
    }

    // Check for renaissance soul (all interaction types used)
    const renaissanceUnlocks = await checkHiddenAchievements({ type: 'interaction_type_used' });
    allAchievementUnlocks.push(...renaissanceUnlocks);
  }

  // 7. Schedule notifications based on interaction type
  if (newInteraction) {
    try {
      const { schedulePostWeaveDeepening, scheduleEventReminder } = await import('./notification-manager-enhanced');

      // For completed weaves: schedule deepening nudge
      if (weaveData.type === 'log' && weaveData.status === 'completed') {
        await schedulePostWeaveDeepening(newInteraction);
      }

      // For planned weaves: schedule event reminder
      if (weaveData.type === 'plan' && weaveData.status === 'planned') {
        await scheduleEventReminder(newInteraction);
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  }

  return {
    interactionId,
    badgeUnlocks: allBadgeUnlocks,
    achievementUnlocks: allAchievementUnlocks,
  };
}

/**
 * Applies weave scores retroactively when a planned interaction is confirmed as completed.
 * This function is called when users confirm that a planned weave actually happened.
 *
 * @param interactionId - The ID of the interaction to score
 * @param database - WatermelonDB instance
 */
export async function applyScoresForCompletedPlan(interactionId: string, database: Database): Promise<void> {
  await database.write(async () => {
    // 1. Get the interaction
    const interaction = await database.get<InteractionModel>('interactions').find(interactionId);

    // 2. Get all friends associated with this interaction
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query(require('@nozbe/watermelondb').Q.where('interaction_id', interactionId))
      .fetch();

    const friendIds = interactionFriends.map(ifriend => ifriend.friendId);
    const friends = await database
      .get<FriendModel>('friends')
      .query(require('@nozbe/watermelondb').Q.where('id', require('@nozbe/watermelondb').Q.oneOf(friendIds)))
      .fetch();

    // 3. Apply scoring logic for each friend (same as logNewWeave)
    for (const friend of friends) {
      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, {
        category: interaction.interactionCategory as InteractionCategory | undefined,
        interactionType: interaction.activity as InteractionType,
        duration: interaction.duration as Duration | null,
        vibe: interaction.vibe as Vibe | null
      });
      const newWeaveScore = Math.min(100, currentScore + pointsToAdd);

      // 4. Update the friend record
      await friend.update(record => {
        record.weaveScore = newWeaveScore;
        record.lastUpdated = new Date();

        // Update resilience if vibe is set
        if (interaction.vibe) {
          record.ratedWeavesCount += 1;
          if (record.ratedWeavesCount >= 5) {
            let newResilience = record.resilience;
            if (interaction.vibe === 'WaxingGibbous' || interaction.vibe === 'FullMoon') {
              newResilience += 0.008;
            } else if (interaction.vibe === 'NewMoon') {
              newResilience -= 0.005;
            }
            record.resilience = Math.max(0.8, Math.min(1.5, newResilience));
          }
        }

        // Reset momentum
        record.momentumScore = 15;
        record.momentumLastUpdated = new Date();

        // Reactivate if dormant
        record.isDormant = false;
        record.dormantSince = null;
      });
    }

    console.log(`✓ Applied weave scores for completed plan ${interactionId}`);
  });
}