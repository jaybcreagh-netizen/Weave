// src/modules/relationships/hooks/useFriendActions.ts
import { useRelationshipsStore } from '../store';

export const useFriendActions = () => {
  const {
    addFriend,
    updateFriend,
    deleteFriend,
    batchAddFriends,
    batchDeleteFriends,
  } = useRelationshipsStore();

  return {
    addFriend,
    updateFriend,
    deleteFriend,
    batchAddFriends,
    batchDeleteFriends,
  };
};
