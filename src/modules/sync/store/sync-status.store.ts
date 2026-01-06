import { create } from 'zustand';

interface SyncStatusState {
    isSyncing: boolean;
    lastSyncTime: number | null;
    lastError: string | null;

    setSyncing: (isSyncing: boolean) => void;
    setLastSyncTime: (time: number) => void;
    setLastError: (error: string | null) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
    isSyncing: false,
    lastSyncTime: null,
    lastError: null,

    setSyncing: (isSyncing) => set({ isSyncing }),
    setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
    setLastError: (lastError) => set({ lastError }),
}));
