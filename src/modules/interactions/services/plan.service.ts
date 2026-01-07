import { database } from '@/db';
import { logger } from '@/shared/services/logger.service';
import Interaction from '@/db/models/Interaction';
import Intention from '@/db/models/Intention';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import UserProfile, { SocialSeason } from '@/db/models/UserProfile';
import { Q } from '@nozbe/watermelondb';
import { processWeaveScoring } from '@/modules/intelligence';
import { recordPractice } from '@/modules/gamification';
import { deleteWeaveCalendarEvent } from './calendar.service';
import { InteractionFormData } from '../types';
import { recalculateScoreOnEdit } from '@/modules/intelligence';

/**
 * Completes a plan, updating its status, applying scoring, and tracking milestones.
 * @param interactionId - The ID of the interaction to complete.
 */
export async function completePlan(interactionId: string, data?: { vibe?: string; note?: string }): Promise<void> {
  const interaction = await database.get<Interaction>('interactions').find(interactionId);
  const previousStatus = interaction.status;

  logger.debug('PlanService', 'Completing interaction:', interactionId, 'Status:', previousStatus);
  if (previousStatus !== 'planned' && previousStatus !== 'pending_confirm') {
    console.warn('[PlanService] Interaction not in planned/pending state:', previousStatus);
    return;
  }

  try {
    await database.write(async () => {
      await interaction.update(i => {
        i.status = 'completed';
        if (data?.vibe) {
          logger.debug('PlanService', 'Setting vibe:', data.vibe);
          i.vibe = data.vibe;
        }
        if (data?.note) {
          i.note = data.note;
        }
      });
    });
    logger.debug('PlanService', 'DB Update committed. Status is now completed.');

    const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', interactionId)).fetch();
    const friendIds = interactionFriends.map(ifriend => ifriend.friendId);
    const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();

    const interactionData: InteractionFormData = {
      friendIds,
      activity: interaction.activity,
      notes: interaction.note,
      date: interaction.interactionDate,
      type: 'log',
      status: 'completed',
      mode: interaction.mode,
      vibe: interaction.vibe as any,
      duration: interaction.duration as any,
      category: interaction.interactionCategory as any,
      reflection: interaction.reflectionJSON ? JSON.parse(interaction.reflectionJSON) : undefined,
    };

    // Apply scoring
    // IF the plan was already in 'pending_confirm', it means it was Auto-Scored (Neutrally) when it became past due.
    // In that case, we should RECALCULATE (Edit) the score instead of adding new points on top.
    if (previousStatus === 'pending_confirm') {
      logger.debug('PlanService', 'Plan was pending_confirm (already scored). Recalculating delta...');
      // Construct "Old Data" based on what we assummed during auto-scoring (Neutral vibe, no notes)
      // Actually, we should read the current state of the interaction from DB (which has the auto-scored state if we saved it, 
      // but typically we only update friend score, not the interaction vibe field in DB during auto-score? 
      // Let's check checkPendingPlans. We DO NOT save vibe to DB there. So DB has no vibe.
      // So "Old Data" is the implied auto-score usage: Vibe='FirstQuarter', Duration=Standard (if not set).

      // However, to be safe, we should use the same defaults we used in checkPendingPlans.
      const oldData: InteractionFormData = {
        ...interactionData,
        vibe: 'FirstQuarter', // Default used in checkPendingPlans
        notes: interaction.note, // Old notes
      };

      for (const friend of friends) {
        await recalculateScoreOnEdit(friend.id, oldData, interactionData, database);
      }
    } else {
      const profileCollection = database.get<UserProfile>('user_profile');
      const profile = (await profileCollection.query().fetch())[0];
      const currentSeason = profile?.currentSocialSeason || 'balanced' as any;
      await processWeaveScoring(friends, interactionData, database, currentSeason);
    }

    await recordPractice('log_weave');
    // TODO: Trigger UI celebration from the hook/store that calls this service.
  } catch (error) {
    logger.error('PlanService', 'Failed to complete plan:', error);

    // Attempt to revert status if it was changed
    try {
      if (interaction.status === 'completed') {
        await database.write(async () => {
          await interaction.update(i => {
            i.status = previousStatus;
          });
        });
        logger.info('PlanService', 'Reverted plan status due to error');
      }
    } catch (revertError) {
      logger.error('PlanService', 'Failed to revert plan status:', revertError);
    }
    throw error;
  }
}

/**
 * Cancels a plan, updating its status and removing any associated calendar events.
 * @param interactionId - The ID of the interaction to cancel.
 */
export async function cancelPlan(interactionId: string): Promise<void> {
  const interaction = await database.get<Interaction>('interactions').find(interactionId);

  await database.write(async () => {
    await interaction.update(i => {
      i.status = 'cancelled';
    });
  });

  if (interaction.calendarEventId) {
    deleteWeaveCalendarEvent(interaction.calendarEventId).catch(err => {
      console.warn(`Failed to delete calendar event for cancelled plan ${interactionId}:`, err);
    });
  }
}
/**
 * Converts an intention to a plan by updating its status to 'converted'.
 * @param intentionId - The ID of the intention to convert.
 */
export async function convertIntentionToPlan(intentionId: string): Promise<void> {
  await database.write(async () => {
    const intention = await database.get<Intention>('intentions').find(intentionId);
    await intention.update(i => {
      i.status = 'converted';
    });
  });
}

/**
 * Checks for past-due planned interactions and transitions them to 'pending_confirm'.
 * 
 * OPTIMIZATION: Batches all plan status updates into a single database.write() call
 * to prevent writer queue congestion at app startup.
 */
export async function checkPendingPlans(): Promise<void> {
  const now = Date.now();

  const pendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'planned'),
      Q.where('interaction_date', Q.lt(now)),
      Q.or(
        Q.where('completion_prompted_at', null),
        Q.where('completion_prompted_at', Q.lt(now - 24 * 60 * 60 * 1000))
      )
    )
    .fetch();

  if (pendingPlans.length === 0) {
    return;
  }

  // Fetch profile once for all plans
  const profileCollection = database.get<UserProfile>('user_profile');
  const profile = (await profileCollection.query().fetch())[0];
  const currentSeason = profile?.currentSocialSeason || 'balanced' as any;

  // Track which plans were successfully scored and their operations
  const successfullyScoredPlans: Interaction[] = [];
  const allScoringOps: any[] = [];

  // Process scoring for each plan
  for (const plan of pendingPlans) {
    try {
      // Fetch friends for this plan
      const iFriends = await plan.interactionFriends.fetch();
      const friendIds = iFriends.map(f => f.friendId);
      const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();

      // Prepare interaction data for scoring
      const interactionData: InteractionFormData = {
        friendIds,
        activity: plan.activity,
        notes: plan.note,
        date: plan.interactionDate,
        type: 'log',
        status: 'completed',
        mode: plan.mode,
        vibe: 'FirstQuarter', // Neutral default
        duration: plan.duration as any,
        category: plan.interactionCategory as any,
      };

      logger.info('PlanService', `Auto-scoring past plan: ${plan.id} with neutral vibe`);

      // Prepare ops instead of executing immediately
      // Use "prepareWeaveScoringOps" which we imported manually or via module
      const { ops } = await import('@/modules/intelligence').then(async m => {
        const { updates } = await m.calculateWeaveScoring(friends, interactionData, database, currentSeason);
        const ops = m.applyWeaveScoringUpdates(friends, updates);
        return { ops };
      });

      if (ops.length > 0) {
        allScoringOps.push(...ops);
      }

      // Mark as successfully scored
      successfullyScoredPlans.push(plan);
    } catch (err) {
      logger.error('PlanService', `Failed to auto-score plan ${plan.id}:`, err);
      // Don't add to successfullyScoredPlans - will retry next time
    }
  }

  // Batch all status updates AND scoring updates into ONE write operation
  if (successfullyScoredPlans.length > 0) {
    const planUpdates = successfullyScoredPlans.map(plan =>
      plan.prepareUpdate(p => {
        p.status = 'pending_confirm';
        p.completionPromptedAt = now;
      })
    );

    const finalBatch = [...allScoringOps, ...planUpdates];

    await database.write(async () => {
      await database.batch(...finalBatch);
    });

    logger.info('PlanService', `Batched status update and scoring for ${successfullyScoredPlans.length} plans (${finalBatch.length} ops)`);
  }
}

/**
 * Checks for old 'pending_confirm' plans and transitions them to 'missed'.
 * If they were auto-scored, should we revert the score?
 * The user asked for "plans give score... as soon as they have happened".
 * If they interpret "missed" as "I actually didn't do it", we should probably Revert/Penalize.
 * But for now, if it moves to 'missed', it means 7 days passed without confirmation.
 * The score was already awarded.
 * Typically 'missed' implies it didn't happen.
 * So strictly speaking, we should probably REVERSE the score if it moves to missed.
 * But let's stick to the user's specific request first.
 */
export async function checkMissedPlans(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const oldPendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'pending_confirm'),
      Q.where('completion_prompted_at', Q.lt(sevenDaysAgo))
    )
    .fetch();

  if (oldPendingPlans.length > 0) {
    await database.write(async () => {
      for (const plan of oldPendingPlans) {
        await plan.update(p => {
          p.status = 'missed';
        });
      }
    });
  }
}
