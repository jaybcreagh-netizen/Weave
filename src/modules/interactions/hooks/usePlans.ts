import { useMemo, useEffect } from 'react';
import { useInteractionsStore } from '../store';
import Interaction from '@/db/models/Interaction';

export function usePlans() {
  const {
    interactions,
    intentions,
    isLoading,
    observeIntentions,
    unobserveIntentions,
    planWeave,
    completePlan,
    cancelPlan,
    createIntention,
    dismissIntention,
  } = useInteractionsStore();

  useEffect(() => {
    observeIntentions();
    return () => unobserveIntentions();
  }, [observeIntentions, unobserveIntentions]);



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
    planWeave,
    completePlan,
    cancelPlan,
    createIntention,
    dismissIntention,
    intentions,

  };
}
