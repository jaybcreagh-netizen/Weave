import { useMemo, useEffect, useState } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import Intention from '@/db/models/Intention';
import { InteractionActions } from '../services/interaction.actions';
import * as WeaveLoggingService from '../services/weave-logging.service';
import * as PlanService from '../services/plan.service';
import { useInteractionObservable } from '@/shared/context/InteractionObservableContext';

/**
 * Hook for accessing plans and intentions data.
 * 
 * OPTIMIZATION: Uses centralized InteractionObservableContext for interactions
 * instead of creating a duplicate subscription. Intentions still use a direct
 * observable since they change less frequently.
 */
export function usePlans() {
  const { interactions, isLoading: interactionsLoading } = useInteractionObservable();
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [intentionsLoading, setIntentionsLoading] = useState(true);

  // Observe Intentions (kept separate - low frequency, different table)
  useEffect(() => {
    const subscription = database.get<Intention>('intentions')
      .query(Q.where('status', 'active'))
      .observe()
      .subscribe({
        next: (data) => {
          setIntentions(data);
          setIntentionsLoading(false);
        },
        error: (err) => {
          console.error('[usePlans] Failed to observe intentions:', err);
          setIntentionsLoading(false);
        }
      });
    return () => subscription.unsubscribe();
  }, []);

  const plannedInteractions = useMemo(() =>
    interactions.filter(i => i.status === 'planned' || i.status === 'pending_confirm'),
    [interactions]
  );

  const pendingConfirmations = useMemo(() =>
    plannedInteractions.filter(p => p.status === 'pending_confirm'),
    [plannedInteractions]
  );

  const upcomingPlans = useMemo(() =>
    plannedInteractions.filter(p => p.status === 'planned'),
    [plannedInteractions]
  );

  const getPlanById = useMemo(
    () => (id: string): Interaction | undefined => {
      return plannedInteractions.find(p => p.id === id);
    },
    [plannedInteractions]
  );

  return {
    plannedInteractions,
    pendingConfirmations,
    upcomingPlans,
    isLoading: interactionsLoading || intentionsLoading,
    getPlanById,
    intentions,
    // Service Actions
    planWeave: WeaveLoggingService.planWeave,
    deleteWeave: WeaveLoggingService.deleteWeave,
    completePlan: PlanService.completePlan,
    cancelPlan: PlanService.cancelPlan,
    createIntention: InteractionActions.createIntention,
    dismissIntention: InteractionActions.dismissIntention,
  };
}

