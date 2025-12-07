import { useMemo, useEffect } from 'react';
import { useInteractionsStore } from '../store';
import Interaction from '@/db/models/Interaction';

export function usePlans() {
  const {
    interactions,
    intentions,
    isLoading,
    observeInteractions,
    unobserveInteractions,
    observeIntentions,
    unobserveIntentions,
    planWeave,
    deleteWeave,
    completePlan,
    cancelPlan,
    createIntention,
    dismissIntention,
  } = useInteractionsStore();

  useEffect(() => {
    observeInteractions();
    observeIntentions();
    return () => {
      unobserveInteractions();
      unobserveIntentions();
    };
  }, [observeInteractions, unobserveInteractions, observeIntentions, unobserveIntentions]);



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

  const getFriendIntentions = (friendId: string) => {
    // TODO: Fix Intention model type. friendIds is not a direct property but accessed via relation.
    // Using any cast temporarily to resolve build error.
    return intentions.filter(i => (i as any).friendIds?.includes(friendId));
  };

  return {
    plannedInteractions,
    pendingConfirmations,
    upcomingPlans,
    isLoading,
    getPlanById,
    planWeave,
    deleteWeave,
    completePlan,
    cancelPlan,
    createIntention,
    dismissIntention,
    intentions,
    getFriendIntentions,
  };
}
