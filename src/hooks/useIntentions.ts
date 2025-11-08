import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import Intention from '../db/models/Intention';

/**
 * Hook to observe all active intentions across all friends
 */
export function useActiveIntentions() {
  const [intentions, setIntentions] = useState<Intention[]>([]);

  useEffect(() => {
    const subscription = database
      .get<Intention>('intentions')
      .query(Q.where('status', 'active'), Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe(setIntentions);

    return () => subscription.unsubscribe();
  }, []);

  return intentions;
}

/**
 * Hook to observe intentions for a specific friend
 * Queries through the intention_friends join table
 */
export function useFriendIntentions(friendId: string | undefined) {
  const [intentions, setIntentions] = useState<Intention[]>([]);

  useEffect(() => {
    if (!friendId) {
      setIntentions([]);
      return;
    }

    // First, observe the join table to get intention IDs for this friend
    const subscription = database
      .get('intention_friends')
      .query(Q.where('friend_id', friendId))
      .observe()
      .subscribe(async (intentionFriends) => {
        if (intentionFriends.length === 0) {
          setIntentions([]);
          return;
        }

        // Extract intention IDs from the join table
        // Access the foreign key column directly using _raw
        const intentionIds = intentionFriends.map((ifriend: any) => ifriend._raw.intention_id);

        // Query the intentions table for these IDs
        const activeIntentions = await database
          .get<Intention>('intentions')
          .query(
            Q.where('id', Q.oneOf(intentionIds)),
            Q.where('status', 'active'),
            Q.sortBy('created_at', Q.desc)
          )
          .fetch();

        setIntentions(activeIntentions);
      });

    return () => subscription.unsubscribe();
  }, [friendId]);

  return intentions;
}
