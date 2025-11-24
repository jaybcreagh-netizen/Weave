import { useEffect, useMemo } from 'react';
import { useInteractionsStore } from '../store';
import Interaction from '@/db/models/Interaction';

export function useInteractions() {
  const {
    interactions,
    isLoading,
    observeInteractions,
    unobserveInteractions,
    logWeave,
    deleteWeave,
    updateInteraction,
    updateReflection,
    updateInteractionCategory,
    updateInteractionVibeAndNotes
  } = useInteractionsStore();

  useEffect(() => {
    observeInteractions();
    return () => unobserveInteractions();
  }, [observeInteractions, unobserveInteractions]);

  const completedInteractions = useMemo(() =>
    interactions.filter(i => i.status === 'completed'),
    [interactions]
  );

  const getInteractionById = (id: string): Interaction | undefined => {
    return interactions.find(i => i.id === id);
  };

  return {
    allInteractions: interactions,
    completedInteractions,
    isLoading,
    getInteractionById,
    logWeave,
    deleteWeave,
    updateInteraction,
    updateReflection,
    updateInteractionCategory,
    updateInteractionVibeAndNotes
  };
}
