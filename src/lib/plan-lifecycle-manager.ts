import { startOfDay, subDays } from 'date-fns';
import { database } from '../db';
import Interaction from '../db/models/Interaction';
import { Q } from '@nozbe/watermelondb';

/**
 * Plan Lifecycle Manager
 *
 * Handles the automatic transition of plans through their lifecycle:
 * 1. 'planned' → Future plans
 * 2. 'pending_confirm' → Past plans needing user confirmation
 * 3. 'completed' → Confirmed happened
 * 4. 'cancelled' → User said didn't happen
 * 5. 'missed' → User never confirmed (after 7 days)
 */

/**
 * Check for past plans that need confirmation
 * Run this:
 * - When app opens (foreground event)
 * - Daily at 9am (if background tasks supported)
 * - When dashboard loads
 *
 * @returns Array of plans that transitioned to pending_confirm
 */
export async function checkPendingPlans(): Promise<Interaction[]> {
  const yesterday = startOfDay(subDays(new Date(), 1));
  const today = startOfDay(new Date());
  const now = Date.now();

  // Find plans from yesterday (or earlier) that haven't been confirmed
  // and haven't been prompted in the last 24 hours
  const pendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'planned'),
      Q.where('interaction_date', Q.lt(today.getTime())), // Past plans only
      Q.or(
        Q.where('completion_prompted_at', null), // Never prompted
        Q.where('completion_prompted_at', Q.lt(now - 24 * 60 * 60 * 1000)) // Or prompted >24h ago
      )
    )
    .fetch();

  if (pendingPlans.length === 0) {
    return [];
  }

  console.log(`📋 Found ${pendingPlans.length} plans needing confirmation`);

  // Update status to 'pending_confirm'
  await database.write(async () => {
    for (const plan of pendingPlans) {
      await plan.update(p => {
        p.status = 'pending_confirm';
        p.completionPromptedAt = now;
      });
    }
  });

  return pendingPlans;
}

/**
 * Mark old pending plans as 'missed' if user hasn't confirmed after 7 days
 * This keeps the pending list clean and acknowledges that memory fades
 */
export async function markOldPlansAsMissed(): Promise<number> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const oldPendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'pending_confirm'),
      Q.where('completion_prompted_at', Q.lt(sevenDaysAgo))
    )
    .fetch();

  if (oldPendingPlans.length === 0) {
    return 0;
  }

  console.log(`⏰ Marking ${oldPendingPlans.length} old pending plans as missed`);

  await database.write(async () => {
    for (const plan of oldPendingPlans) {
      await plan.update(p => {
        p.status = 'missed';
      });
    }
  });

  return oldPendingPlans.length;
}

/**
 * Confirm a plan as completed
 * @param planId - The interaction ID
 * @param shouldAddReflection - Whether to prompt for reflection
 */
export async function confirmPlan(planId: string): Promise<void> {
  await database.write(async () => {
    const plan = await database.get<Interaction>('interactions').find(planId);
    await plan.update(p => {
      p.status = 'completed';
    });
  });

  console.log(`✓ Plan ${planId} confirmed as completed`);
}

/**
 * Cancel a plan (didn't happen)
 * @param planId - The interaction ID
 */
export async function cancelPlan(planId: string): Promise<void> {
  await database.write(async () => {
    const plan = await database.get<Interaction>('interactions').find(planId);
    await plan.update(p => {
      p.status = 'cancelled';
    });
  });

  console.log(`✗ Plan ${planId} marked as cancelled`);
}

/**
 * Reschedule a cancelled or missed plan
 * Returns the plan data for prefilling the wizard
 * @param planId - The interaction ID
 */
export async function getRescheduleData(planId: string) {
  const plan = await database.get<Interaction>('interactions').find(planId);
  const interactionFriends = await plan.interactionFriends.fetch();

  return {
    friendIds: interactionFriends.map(jf => jf.friendId),
    category: plan.interactionCategory,
    title: plan.title,
    location: plan.location,
    notes: plan.note,
  };
}

/**
 * Get all pending confirmations for the dashboard
 */
export async function getPendingConfirmations(): Promise<Interaction[]> {
  const pendingPlans = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'pending_confirm'),
      Q.sortBy('interaction_date', Q.desc)
    )
    .fetch();

  return pendingPlans;
}

/**
 * Run all lifecycle checks
 * Call this on app start or when dashboard loads
 */
export async function runLifecycleChecks(): Promise<{
  newPending: Interaction[];
  markedMissed: number;
}> {
  const [newPending] = await Promise.all([
    checkPendingPlans(),
    markOldPlansAsMissed().then(count => count),
  ]);

  return {
    newPending,
    markedMissed: await markOldPlansAsMissed(),
  };
}
