import { Database } from '@nozbe/watermelondb';
import { Friend, Interaction, Tier, Archetype, InteractionType, Duration, Vibe } from '../components/types';
import { TierDecayRates, InteractionBaseScores, DurationModifiers, VibeMultipliers, RecencyFactors, ArchetypeMatrixV2 } from './constants';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';

/**
 * Calculates the decayed score of a friend based on the time since the last update.
 * @param friend The Friend model instance.
 * @returns The decayed weave score.
 */
export function calculateCurrentScore(friend: FriendModel): number {
  const daysSinceLastUpdate = (Date.now() - friend.lastUpdated.getTime()) / 86400000;
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
  const decayAmount = daysSinceLastUpdate * tierDecayRate;
  return Math.max(0, friend.weaveScore - decayAmount);
}

/**
 * Calculates the points for a new interaction.
 * @param friend The Friend model instance.
 * @param weaveData The data for the new interaction.
 * @returns The points for the new weave.
 */
export function calculatePointsForWeave(friend: FriendModel, weaveData: { interactionType: InteractionType; duration: Duration | null; vibe: Vibe | null }): number {
  const baseScore = InteractionBaseScores[weaveData.interactionType];
  const archetypeMultiplier = ArchetypeMatrixV2[friend.archetype as Archetype][weaveData.interactionType];
  const durationModifier = DurationModifiers[weaveData.duration || 'Standard'];
  const vibeMultiplier = VibeMultipliers[weaveData.vibe || 'WaxingCrescent'];
  const eventMultiplier = 1.0; // Hardcoded for Phase 1

  const initialPoints = baseScore * archetypeMultiplier * durationModifier;
  const finalPoints = initialPoints * vibeMultiplier * eventMultiplier;
  return finalPoints;
}

/**
 * Logs a new interaction, calculates the new scores, and updates the database in a single transaction.
 * @param friendsToUpdate An array of Friend model instances.
 * @param weaveData The data for the new interaction.
 * @param database A reference to the WatermelonDB database object.
 */
export async function logNewWeave(friendsToUpdate: FriendModel[], weaveData: Omit<Interaction, 'id' | 'friendIds' | 'createdAt'>, database: Database): Promise<void> {
  await database.write(async () => {
    const newInteraction = await database.get<InteractionModel>('interactions').create(interaction => {
      interaction.interactionDate = weaveData.interactionDate;
      interaction.interactionType = weaveData.interactionType;
      interaction.duration = weaveData.duration;
      interaction.vibe = weaveData.vibe;
      interaction.note = weaveData.note;
    });

    for (const friend of friendsToUpdate) {
      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, weaveData);

      const recencyFactor = RecencyFactors.find(rf => currentScore >= rf.min && currentScore <= rf.max)?.factor || 1.0;

      const finalPointsToAdd = pointsToAdd * recencyFactor;
      const newWeaveScore = Math.min(100, currentScore + finalPointsToAdd);

      await friend.update(() => {
        friend.weaveScore = newWeaveScore;
        friend.lastUpdated = new Date();
      });

      // Create the join table record
      await database.get('interaction_friends').create(ifriend => {
          ifriend.interaction.id = newInteraction.id;
          ifriend.friend.id = friend.id;
      });
    }
  });
}
