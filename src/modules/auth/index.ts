// src/modules/auth/index.ts

// Hooks
export * from './hooks/useFeatureGate';

// Components
export * from './components/SyncConflictModal';

// Stores
export * from './store/auth.store';
export * from './store/user-profile.store';
export * from './store/sync.store';

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
export * from './services/social-battery.service';

export * from './services/sync-engine';
export * from './services/background-event-sync';
export * from './services/data-export';
export * from './services/data-import';
export * from './services/subscription-tiers';
