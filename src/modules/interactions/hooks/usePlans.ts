import { useMemo, useEffect, useState } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import Intention from '@/db/models/Intention';
import { InteractionActions } from '../services/interaction.actions';
import * as WeaveLoggingService from '../services/weave-logging.service';
import * as PlanService from '../services/plan.service';

export function usePlans() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Observe Interactions (Only planned/pending to optimize? Or all? Store did all)
  // Store filtered by Q.sortBy('interaction_date', Q.desc)
  useEffect(() => {
    const subscription = database.get<Interaction>('interactions')
      .query(Q.sortBy('interaction_date', Q.desc))
      .observe()
      .subscribe({
        next: (data) => {
          setInteractions(data);
          setIsLoading(false);
        },
        error: (err) => {
          console.error('[usePlans] Failed to observe interactions:', err);
          setIsLoading(false);
        }
      });
    return () => subscription.unsubscribe();
  }, []);

  // Observe Intentions
  useEffect(() => {
    const subscription = database.get<Intention>('intentions')
      .query(Q.where('status', 'active'))
      .observe()
      .subscribe({
        next: (data) => {
          setIntentions(data);
        },
        error: (err) => {
          console.error('[usePlans] Failed to observe intentions:', err);
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

  const getPlanById = (id: string): Interaction | undefined => {
    return plannedInteractions.find(p => p.id === id);
  };

  return {
    plannedInteractions,
    pendingConfirmations,
    upcomingPlans,
    isLoading,
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
