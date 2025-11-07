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
    console.log('[useActiveIntentions] Setting up observer');

    const subscription = database
      .get<Intention>('intentions')
      .query(Q.where('status', 'active'), Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((newIntentions) => {
        console.log('[useActiveIntentions] Received intentions update:', newIntentions.length);
        setIntentions(newIntentions);
      });

    return () => {
      console.log('[useActiveIntentions] Cleaning up observer');
      subscription.unsubscribe();
    };
  }, []);

  console.log('[useActiveIntentions] Current intentions count:', intentions.length);
  return intentions;
}

/**
 * Hook to observe intentions for a specific friend
 */
export function useFriendIntentions(friendId: string | undefined) {
  const [intentions, setIntentions] = useState<Intention[]>([]);

  useEffect(() => {
    if (!friendId) {
      setIntentions([]);
      return;
    }

    console.log('[useFriendIntentions] Setting up observer for friend:', friendId);

    const loadIntentions = async () => {
      // Get intention_friends records for this friend
      const intentionFriends = await database
        .get('intention_friends')
        .query(Q.where('friend_id', friendId))
        .fetch();

      const intentionIds = intentionFriends.map((if_record: any) => if_record.intentionId);
      console.log('[useFriendIntentions] Found intention IDs:', intentionIds);

      if (intentionIds.length === 0) {
        setIntentions([]);
        return;
      }

      // Query intentions by IDs
      const subscription = database
        .get<Intention>('intentions')
        .query(
          Q.where('id', Q.oneOf(intentionIds)),
          Q.where('status', 'active'),
          Q.sortBy('created_at', Q.desc)
        )
        .observe()
        .subscribe((newIntentions) => {
          console.log('[useFriendIntentions] Received intentions update:', newIntentions.length);
          setIntentions(newIntentions);
        });

      return subscription;
    };

    const subscription = loadIntentions();

    return () => {
      subscription.then(sub => sub?.unsubscribe());
    };
  }, [friendId]);

  console.log('[useFriendIntentions] Current intentions count for friend:', intentions.length);
  return intentions;
}
