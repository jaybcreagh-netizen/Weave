import Friend from '@/db/models/Friend';
import LifeEvent from '@/db/models/LifeEvent';
import { Tier, SyncStatus } from '@/shared/types/common';

// Utility to override specific properties
// We use Omit to remove the loose type from the Model, and then intersection to add the strict type
type Hydrate<T, K extends keyof T, NewType> = Omit<T, K> & { [P in K]: NewType };

// Hydrated Friend
// Overrides dunbarTier (string -> Tier) and customSyncStatus (string | undefined -> SyncStatus | undefined)
export type HydratedFriend = Hydrate<Friend, 'dunbarTier', Tier> & {
    customSyncStatus?: SyncStatus;
};

// Hydrated LifeEvent
// Overrides customSyncStatus (string | undefined -> SyncStatus | undefined)
export type HydratedLifeEvent = Hydrate<LifeEvent, 'customSyncStatus', SyncStatus>;
