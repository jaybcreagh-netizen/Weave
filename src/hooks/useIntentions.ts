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
 */
export function useFriendIntentions(friendId: string | undefined) {
  const [intentions, setIntentions] = useState<Intention[]>([]);

  useEffect(() => {
    if (!friendId) {
      setIntentions([]);
      return;
    }

    const subscription = database
      .get<Intention>('intentions')
      .query(
        Q.where('friend_id', friendId),
        Q.where('status', 'active'),
        Q.sortBy('created_at', Q.desc)
      )
      .observe()
      .subscribe(setIntentions);

    return () => subscription.unsubscribe();
  }, [friendId]);

  return intentions;
}
