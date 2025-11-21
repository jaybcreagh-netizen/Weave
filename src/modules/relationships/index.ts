// src/modules/relationships/index.ts
export { useFriends } from './hooks/useFriends';
export { useFriendActions } from './hooks/useFriendActions';
export { useRelationshipsStore } from './store';
export * from './types';
export {
  createFriend,
  updateFriend,
  deleteFriend,
  batchAddFriends,
} from './services/friend.service';
export {
  checkAndApplyDormancy,
  reactivateFriend,
} from './services/lifecycle.service';
export {
  uploadFriendPhoto,
  deleteFriendPhoto,
} from './services/image.service';
export * from './utils/image.utils';
export * from './services/life-event-detection';
export * from './services/life-event.service';
export { FriendForm } from './components/FriendForm';
export { FriendListRow } from './components/FriendListRow';
export { FriendDetailSheet } from './components/FriendDetailSheet';
