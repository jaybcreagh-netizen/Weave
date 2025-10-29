import { useState, useEffect } from 'react';
import { database } from '../db';
import FriendModel from '../db/models/Friend';

export function useFriends() {
  const [friends, setFriends] = useState<FriendModel[]>([]);

  useEffect(() => {
    const subscription = database
      .get<FriendModel>('friends')
      .query()
      .observe()
      .subscribe(setFriends);

    return () => subscription.unsubscribe();
  }, []); // Empty deps - subscribe once on mount, cleanup on unmount

  return friends;
}
