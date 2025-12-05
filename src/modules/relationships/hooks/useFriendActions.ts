// src/modules/relationships/hooks/useFriendActions.ts
import {
  createFriend,
  updateFriend,
  deleteFriend,
  batchAddFriends,
} from '../services/friend.service';
import { Tier } from '../types';

export const useFriendActions = () => {
  const batchDeleteFriends = async (ids: string[]) => {
    for (const id of ids) {
      await deleteFriend(id);
    }
  };

  return {
    addFriend: createFriend,
    updateFriend,
    deleteFriend,
    batchAddFriends,
    batchDeleteFriends,
  };
};
