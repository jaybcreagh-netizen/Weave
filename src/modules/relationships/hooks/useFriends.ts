// src/modules/relationships/hooks/useFriends.ts
import { useEffect, useState } from 'react';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

/**
 * @deprecated This hook is deprecated. Use direct WatermelonDB observations or withObservables instead.
 */
export const useFriends = () => {
  const [friends, setFriends] = useState<FriendModel[]>([]);

  useEffect(() => {
    // console.warn('[Deprecation] useFriends is deprecated. Please migrate to direct WatermelonDB observations.');

    const subscription = database.get<FriendModel>('friends')
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe(setFriends);

    return () => subscription.unsubscribe();
  }, []);

  return friends;
};
