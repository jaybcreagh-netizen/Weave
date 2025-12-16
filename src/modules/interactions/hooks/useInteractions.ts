import { useEffect, useMemo, useState } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import { InteractionActions } from '../services/interaction.actions';
import * as WeaveLoggingService from '../services/weave-logging.service';

export function useInteractions() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          console.error('[useInteractions] Failed to observe interactions:', err);
          setIsLoading(false);
        }
      });

    return () => subscription.unsubscribe();
  }, []);

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
    // Actions delegated to services
    logWeave: WeaveLoggingService.logWeave,
    deleteWeave: WeaveLoggingService.deleteWeave,
    updateInteraction: InteractionActions.updateInteraction,
    updateReflection: InteractionActions.updateReflection,
    updateInteractionCategory: InteractionActions.updateInteractionCategory,
    updateInteractionVibeAndNotes: InteractionActions.updateInteractionVibeAndNotes
  };
}
