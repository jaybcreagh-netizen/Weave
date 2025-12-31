import { useMemo } from 'react';
import Interaction from '@/db/models/Interaction';
import { InteractionActions } from '../services/interaction.actions';
import * as WeaveLoggingService from '../services/weave-logging.service';
import { useInteractionObservable } from '@/shared/context/InteractionObservableContext';

/**
 * Hook for accessing interactions data and actions.
 * 
 * OPTIMIZATION: Uses centralized InteractionObservableContext instead of
 * creating its own observable subscription. This reduces the number of
 * subscriptions that fire on each database write.
 */
export function useInteractions() {
  const {
    interactions,
    completedInteractions,
    isLoading
  } = useInteractionObservable();

  const getInteractionById = useMemo(
    () => (id: string): Interaction | undefined => {
      return interactions.find(i => i.id === id);
    },
    [interactions]
  );

  return {
    allInteractions: interactions,
    completedInteractions,
    isLoading,
    getInteractionById,
    // Actions delegated to services
    logWeave: WeaveLoggingService.logWeave,
    deleteWeave: WeaveLoggingService.deleteWeave,
    updateInteraction: InteractionActions.updateInteraction,
    updateReflection: InteractionActions.updateReflection,
    updateInteractionCategory: InteractionActions.updateInteractionCategory,
    updateInteractionVibeAndNotes: InteractionActions.updateInteractionVibeAndNotes
  };
}

