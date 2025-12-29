/**
 * Sync Module
 * 
 * Public API for sync functionality.
 */

// Services
export {
    enqueueOperation,
    startProcessing,
    processQueue,
    getQueueStats,
    retryFailed,
    clearOldCompleted,
} from './services/sync-engine.service';

export {
    executeShareWeave,
    executeAcceptWeave,
    executeDeclineWeave,
} from './services/sync-operations';

export {
    subscribeToRealtime,
    unsubscribeFromRealtime,
    onIncomingWeave,
    onIncomingLink,
} from './services/realtime.service';

export {
    shareWeave,
    getShareStatus,
    getLinkedFriendsFromIds,
} from './services/share-weave.service';

export {
    acceptWeave,
    declineWeave,
    fetchPendingSharedWeaves,
} from './services/receive-weave.service';

// Components
export { ShareWeaveToggle } from './components/ShareWeaveToggle';
export { ShareStatusBadge } from './components/ShareStatusBadge';
export { SharedWeaveCard, type SharedWeaveData } from './components/SharedWeaveCard';
export { PendingWeavesSheet } from './components/PendingWeavesSheet';
export { ActivityInboxSheet } from './components/ActivityInboxSheet';

// Hooks
export { useSyncStatus } from './hooks/useSyncStatus';
export { usePendingWeaves } from './hooks/usePendingWeaves';
