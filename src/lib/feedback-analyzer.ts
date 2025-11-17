import { database } from '../db';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionOutcome from '../db/models/InteractionOutcome';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import { InteractionCategory } from '../types/suggestions';
import { TierDecayRates } from '@/shared/constants/constants';
import { Tier } from '../components/types';

/**
 * Captures the effectiveness outcome of a logged interaction
 * Waits for next interaction or 7 days to measure actual impact
 */
export async function captureInteractionOutcome(
  interactionId: string,
  friendId: string,
  scoreBefore: number,
  expectedImpact: number
): Promise<void> {
  // Check if we already have an outcome for this interaction
  const existing = await database
    .get<InteractionOutcome>('interaction_outcomes')
    .query(Q.where('interaction_id', interactionId))
    .fetch();

  if (existing.length > 0) {
    return; // Already tracked
  }

  const interaction = await database.get<InteractionModel>('interactions').find(interactionId);
  const friend = await database.get<FriendModel>('friends').find(friendId);

  // Store initial data - we'll measure outcome later
  await database.write(async () => {
    await database.get<InteractionOutcome>('interaction_outcomes').create(outcome => {
      outcome.interactionId = interactionId;
      outcome.friendId = friendId;
      outcome.scoreBefore = scoreBefore;
      outcome.scoreAfter = scoreBefore; // Will update later
      outcome.scoreChange = 0; // Will update later
      outcome.category = interaction.interactionCategory || 'text-call';
      outcome.duration = interaction.duration;
      outcome.vibe = interaction.vibe;
      outcome.hadReflection = !!interaction.reflectionJSON || !!interaction.note;
      outcome.expectedImpact = expectedImpact;
      outcome.actualImpact = 0; // Will calculate later
      outcome.effectivenessRatio = 1.0; // Will calculate later
      outcome.interactionDate = interaction.interactionDate;
      outcome.measuredAt = new Date(); // Will update when actually measured
    });
  });
}

/**
 * Measures the outcome of previous interactions
 * Called periodically (e.g., when new interaction logged or daily background job)
 */
export async function measurePendingOutcomes(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Find outcomes that haven't been measured yet (actualImpact = 0)
  const pendingOutcomes = await database
    .get<InteractionOutcome>('interaction_outcomes')
    .query(
      Q.where('actual_impact', 0),
      Q.where('interaction_date', Q.lte(sevenDaysAgo)) // At least 7 days old
    )
    .fetch();

  for (const outcome of pendingOutcomes) {
    try {
      const friend = await database.get<FriendModel>('friends').find(outcome.friendId);

      // Get the next interaction after this one, or use current score if 7+ days passed
      const laterInteractions = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gt(outcome.interactionDate.getTime())),
          Q.sortBy('interaction_date', Q.asc),
          Q.take(1)
        )
        .fetch();

      const now = Date.now();
      const daysSinceInteraction = (now - outcome.interactionDate.getTime()) / 86400000;

      let scoreAfter: number;
      let measuredAt: Date;

      if (laterInteractions.length > 0) {
        // Measure at next interaction
        const nextInteraction = laterInteractions[0];
        scoreAfter = calculateScoreAtTime(friend, outcome, nextInteraction.interactionDate);
        measuredAt = nextInteraction.interactionDate;
      } else if (daysSinceInteraction >= 7) {
        // No next interaction yet, measure now (7+ days later)
        scoreAfter = calculateCurrentScore(friend);
        measuredAt = new Date();
      } else {
        // Not ready to measure yet
        continue;
      }

      // Calculate actual impact accounting for decay
      const daysBetween = (measuredAt.getTime() - outcome.interactionDate.getTime()) / 86400000;
      const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
      const expectedDecay = (daysBetween * tierDecayRate) / friend.resilience;

      // Actual impact = (scoreAfter - scoreBefore) + expectedDecay
      // This accounts for what would have happened without the interaction
      const rawChange = scoreAfter - outcome.scoreBefore;
      const actualImpact = rawChange + expectedDecay;

      const effectivenessRatio = outcome.expectedImpact > 0
        ? actualImpact / outcome.expectedImpact
        : 1.0;

      // Update outcome with measurements
      await database.write(async () => {
        await outcome.update(record => {
          record.scoreAfter = scoreAfter;
          record.scoreChange = rawChange;
          record.actualImpact = actualImpact;
          record.effectivenessRatio = effectivenessRatio;
          record.measuredAt = measuredAt;
        });
      });

      // Update friend's learned effectiveness
      await updateLearnedEffectiveness(friend, outcome.category as InteractionCategory, effectivenessRatio);

    } catch (error) {
      console.error(`Error measuring outcome for interaction ${outcome.interactionId}:`, error);
    }
  }
}

/**
 * Calculates what the score would have been at a specific time
 * accounting for decay
 */
function calculateScoreAtTime(
  friend: FriendModel,
  outcome: InteractionOutcome,
  targetTime: Date
): number {
  const daysSince = (targetTime.getTime() - outcome.interactionDate.getTime()) / 86400000;
  const tierDecayRate = TierDecayRates[friend.dunbarTier as Tier];
  const decayAmount = (daysSince * tierDecayRate) / friend.resilience;

  // Start from score right after the interaction
  const scoreAfterInteraction = outcome.scoreBefore + outcome.expectedImpact;
  return Math.max(0, scoreAfterInteraction - decayAmount);
}

/**
 * Updates a friend's learned effectiveness for a category
 */
async function updateLearnedEffectiveness(
  friend: FriendModel,
  category: InteractionCategory,
  effectivenessRatio: number
): Promise<void> {
  await database.write(async () => {
    await friend.update(record => {
      // Parse existing effectiveness data
      let effectiveness: Record<string, number> = {};
      if (record.categoryEffectiveness) {
        try {
          effectiveness = JSON.parse(record.categoryEffectiveness);
        } catch (e) {
          console.warn('Failed to parse category effectiveness:', e);
        }
      }

      // Update with exponential moving average (weight new data at 20%)
      const currentValue = effectiveness[category] || 1.0;
      const alpha = 0.2; // Learning rate
      effectiveness[category] = currentValue * (1 - alpha) + effectivenessRatio * alpha;

      record.categoryEffectiveness = JSON.stringify(effectiveness);
      record.outcomeCount += 1;
    });
  });
}

/**
 * Gets learned effectiveness for a friend's category
 * Returns 1.0 if no data yet (neutral)
 */
export function getLearnedEffectiveness(
  friend: FriendModel,
  category: InteractionCategory
): number {
  if (!friend.categoryEffectiveness) {
    return 1.0;
  }

  try {
    const effectiveness: Record<string, number> = JSON.parse(friend.categoryEffectiveness);
    return effectiveness[category] || 1.0;
  } catch (e) {
    console.warn('Failed to parse category effectiveness:', e);
    return 1.0;
  }
}

/**
 * Gets all learned effectiveness data for a friend
 */
export function getAllLearnedEffectiveness(
  friend: FriendModel
): Record<InteractionCategory, number> {
  const defaults: Record<InteractionCategory, number> = {
    'text-call': 1.0,
    'voice-note': 1.0,
    'meal-drink': 1.0,
    'hangout': 1.0,
    'deep-talk': 1.0,
    'event-party': 1.0,
    'activity-hobby': 1.0,
    'favor-support': 1.0,
    'celebration': 1.0,
  };

  if (!friend.categoryEffectiveness) {
    return defaults;
  }

  try {
    const learned: Record<string, number> = JSON.parse(friend.categoryEffectiveness);
    return { ...defaults, ...learned } as Record<InteractionCategory, number>;
  } catch (e) {
    console.warn('Failed to parse category effectiveness:', e);
    return defaults;
  }
}

/**
 * Analyzes effectiveness patterns for insights
 */
export interface EffectivenessInsights {
  mostEffective: Array<{ category: InteractionCategory; ratio: number }>;
  leastEffective: Array<{ category: InteractionCategory; ratio: number }>;
  confidenceLevel: 'low' | 'medium' | 'high';
  sampleSize: number;
  recommendations: string[];
}

export function analyzeEffectiveness(friend: FriendModel): EffectivenessInsights {
  const allEffectiveness = getAllLearnedEffectiveness(friend);
  const sampleSize = friend.outcomeCount || 0;

  // Determine confidence based on sample size
  let confidenceLevel: 'low' | 'medium' | 'high';
  if (sampleSize < 5) {
    confidenceLevel = 'low';
  } else if (sampleSize < 15) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'high';
  }

  // Find most and least effective
  const entries = Object.entries(allEffectiveness) as Array<[InteractionCategory, number]>;
  const sorted = entries
    .filter(([_, ratio]) => ratio !== 1.0) // Only show categories with learned data
    .sort(([_, a], [__, b]) => b - a);

  const mostEffective = sorted.slice(0, 3);
  const leastEffective = sorted.slice(-3).reverse();

  // Generate recommendations
  const recommendations: string[] = [];

  if (confidenceLevel !== 'low') {
    if (mostEffective.length > 0 && mostEffective[0][1] > 1.2) {
      recommendations.push(`${mostEffective[0][0]} works exceptionally well with ${friend.name} (${Math.round(mostEffective[0][1] * 100)}% effective)`);
    }

    if (leastEffective.length > 0 && leastEffective[0][1] < 0.8) {
      recommendations.push(`${leastEffective[0][0]} seems less effective (${Math.round(leastEffective[0][1] * 100)}% effective) - try other types`);
    }
  } else {
    recommendations.push('Need more data to provide reliable recommendations');
  }

  return {
    mostEffective,
    leastEffective,
    confidenceLevel,
    sampleSize,
    recommendations,
  };
}
