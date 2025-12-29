// src/modules/relationships/index.ts
export { useFriendActions } from './hooks/useFriendActions';
export { useFriendProfileData } from './hooks/useFriendProfileData';
export { useFriendProfileModals } from './hooks/useFriendProfileModals';
export { useFriendTimeline } from './hooks/useFriendTimeline';

export * from './types';
export {
  createFriend,
  updateFriend,
  deleteFriend,
  batchAddFriends,
} from './services/friend.service';
export {
  searchUsersByUsername,
  sendLinkRequest,
  createLinkedFriend,
  getPendingIncomingRequests,
  acceptLinkRequest,
  declineLinkRequest,
  unlinkFriend,
  type WeaveUserSearchResult,
  type LinkRequest,
} from './services/friend-linking.service';
export {
  checkAndApplyDormancy,
  reactivateFriend,
} from './services/lifecycle.service';
export {
  uploadFriendPhoto,
  deleteFriendPhoto,
  uploadGroupPhoto,
  deleteGroupPhoto,
  resolveImageUri,
} from './services/image.service';
export * from './utils/image.utils';
export * from './services/life-event-detection';
export * from './services/life-event.service';
export { FriendForm } from './components/FriendForm';
export { FriendListRow, FriendListRowContent } from './components/FriendListRow';
export { FriendTierList } from './components/FriendTierList';
export { FriendDetailSheet } from './components/FriendDetailSheet';
export { FriendSearchBar, type SearchFilters, type HealthStatus, type SortOption } from './components/FriendSearchBar';
export { FriendSearchResults } from './components/FriendSearchResults';

// Components
export { TimelineItem } from './components/TimelineItem';
export { IntentionsDrawer } from './components/IntentionsDrawer';
export { IntentionActionSheet } from './components/IntentionActionSheet';
export { LifeEventModal } from './components/LifeEventModal';
export { default as FriendBadgePopup } from './components/FriendBadgePopup';
export { TierBalanceContent } from './components/TierBalanceContent';
export { FriendSelector } from './components/FriendSelector';
export { ReciprocitySelector, InitiatorType } from './components/ReciprocitySelector';
export { FriendManagementModal } from './components/FriendManagementModal';
export { IntentionsList } from './components/IntentionsList';
export { TierInfo } from './components/TierInfo';
export { TierSegmentedControl } from './components/TierSegmentedControl';
export { AddFriendMenu } from './components/AddFriendMenu';
export { FriendPickerSheet } from './components/FriendPickerSheet';
export { DuplicateResolverModal } from './components/DuplicateResolverModal';
export { ProfileHeader } from './components/profile/ProfileHeader';
export { ActionButtons } from './components/profile/ActionButtons';
export { LifeEventsSection } from './components/profile/LifeEventsSection';
export { TimelineList } from './components/profile/TimelineList';
export { FriendProfileModals } from './components/profile/FriendProfileModals';
export { IntentionsFAB } from './components/IntentionsFAB';
// Screens
export { FriendsDashboardScreen } from './screens/FriendsDashboardScreen';

