// src/modules/auth/index.ts

// Hooks
export * from './hooks/useFeatureGate';

// Components
export * from './components/SyncConflictModal';
export * from './components/VisibilitySettings';

// Stores
export * from './store/auth.store';
export * from './store/user-profile.store';
export * from './store/background-event-sync.store';

// Context (new)
export * from './context/AuthContext';
export * from './context/SyncConflictContext';

// New hooks
export * from './hooks/useUserProfile';
export * from './hooks/useSocialBatteryStats';
export * from './hooks/useSubscription';
export * from './hooks/useUsage';
export * from './hooks/useSyncSettings';

// Services
export * from './services/supabase.service';
export * from './services/supabase-auth.service';
export * from './services/social-battery.service';
export * from './services/username.service';

// Data Replication (re-exported from sync module for backwards compatibility)
export {
    DataReplicationService,
    SyncEngine, // Legacy alias
    createDataReplicationService,
    createSyncEngine, // Legacy alias
    triggerAutoSync,
} from '@/modules/sync';
export * from './services/background-event-sync';
export * from './services/data-export';
export * from './services/data-import';
export * from './services/subscription-tiers';
