import { startOfDay, subDays } from 'date-fns';
import { database } from '@/db';
import { logger } from '@/shared/services/logger.service';
import Interaction from '@/db/models/Interaction';
import Intention from '@/db/models/Intention';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { processWeaveScoring } from '@/modules/intelligence';
import { useUserProfileStore } from '@/modules/auth';
import { recordPractice } from '@/modules/gamification';
import { deleteWeaveCalendarEvent } from './calendar.service';
import { InteractionFormData } from '../types';

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

  // Apply scoring with season-aware bonuses
  const currentSeason = useUserProfileStore.getState().getSocialSeason();
  await processWeaveScoring(friends, interactionData, database, currentSeason);
  await recordPractice('log_weave');
  // TODO: Trigger UI celebration from the hook/store that calls this service.
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
 */
export async function checkPendingPlans(): Promise<void> {
  const today = startOfDay(new Date());
  const now = Date.now();

  const pendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'planned'),
      Q.where('interaction_date', Q.lt(now)),
      Q.where('interaction_date', Q.gte(today.getTime() - 2 * 24 * 60 * 60 * 1000)), // Limit to last 48 hours (previous day + padding)
      Q.or(
        Q.where('completion_prompted_at', null),
        Q.where('completion_prompted_at', Q.lt(now - 24 * 60 * 60 * 1000))
      )
    )
    .fetch();

  if (pendingPlans.length > 0) {
    await database.write(async () => {
      for (const plan of pendingPlans) {
        await plan.update(p => {
          p.status = 'pending_confirm';
          p.completionPromptedAt = now;
        });
      }
    });
  }
}

/**
 * Checks for old 'pending_confirm' plans and transitions them to 'missed'.
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
