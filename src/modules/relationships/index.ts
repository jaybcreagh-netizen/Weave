// src/modules/relationships/index.ts
export { useFriendActions } from './hooks/useFriendActions';
export { useFriendProfileData } from './hooks/useFriendProfileData';
export { useFriendTimeline } from './hooks/useFriendTimeline';

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
export { FriendListRow, FriendListRowContent } from './components/FriendListRow';
export { FriendDetailSheet } from './components/FriendDetailSheet';
export { FriendSearchBar, type SearchFilters, type HealthStatus } from './components/FriendSearchBar';
export { FriendSearchResults } from './components/FriendSearchResults';
