import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { startOfDay, addDays, differenceInDays } from 'date-fns';
import { database } from '../db';
import InteractionModel from '../db/models/Interaction';
import FriendModel from '../db/models/Friend';

export interface PendingPlan {
  interaction: InteractionModel;
  friends: FriendModel[];
  daysUntil: number;
}

/**
 * Hook to fetch pending plans (status='planned') within the next 7 days
 */
export function usePendingPlans() {
  const [pendingPlans, setPendingPlans] = useState<PendingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7);

    // Observe interactions with status='planned'
    const subscription = database
      .get<InteractionModel>('interactions')
      .query(
        Q.where('status', 'planned'),
        Q.where('interaction_date', Q.gte(today.getTime())),
        Q.where('interaction_date', Q.lte(nextWeek.getTime())),
        Q.sortBy('interaction_date', Q.asc)
      )
      .observe()
      .subscribe(async (interactions) => {
        // For each interaction, fetch the associated friends
        const plans: PendingPlan[] = await Promise.all(
          interactions.map(async (interaction) => {
            // Query the join table for friend IDs
            const joinRecords = await database
              .get('interaction_friends')
              .query(Q.where('interaction_id', interaction.id))
              .fetch();

            const friendIds = joinRecords.map((jr: any) => jr.friendId);

            // Fetch the friend records
            let friends: FriendModel[] = [];
            if (friendIds.length > 0) {
              friends = await database
                .get<FriendModel>('friends')
                .query(Q.where('id', Q.oneOf(friendIds)))
                .fetch();
            }

            const daysUntil = differenceInDays(
              startOfDay(interaction.interactionDate),
              today
            );

            return { interaction, friends, daysUntil };
          })
        );

        setPendingPlans(plans);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  return { pendingPlans, isLoading };
}
