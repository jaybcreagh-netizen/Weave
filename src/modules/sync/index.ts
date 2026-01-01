/**
 * Sync Module
 * 
 * Public API for sync functionality.
 */

// Action Queue Service (offline operation queue)
export {
    enqueueOperation,
    startProcessing,
    processQueue,
    getQueueStats,
    retryFailed,
    clearOldCompleted,
} from './services/action-queue.service';

// Data Replication Service (moved from auth module)
export {
    DataReplicationService,
    SyncEngine, // Legacy alias
    createDataReplicationService,
    createSyncEngine, // Legacy alias
    triggerAutoSync,
} from './services/data-replication.service';

export {
    executeShareWeave,
    executeAcceptWeave,
    executeDeclineWeave,
    executeSendLinkRequest,
    executeAcceptLinkRequest,
    executeDeclineLinkRequest,
} from './services/sync-operations';

export {
    subscribeToRealtime,
    unsubscribeFromRealtime,
    onIncomingWeave,
    onIncomingLink,
    onOutgoingLinkStatusChange,
    onParticipantResponse,
    getRealtimeStatus,
    forceReconnect,
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
