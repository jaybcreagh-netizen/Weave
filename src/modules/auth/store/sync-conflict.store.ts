import { create } from 'zustand';
import type { Model } from '@nozbe/watermelondb';

export interface ConflictData {
    id: string;
    tableName: string;
    localRecord: Model;
    serverRecord: any;
    resolve: (strategy: 'keep_local' | 'keep_server') => Promise<void>;
}

interface SyncConflictStore {
    conflicts: ConflictData[];
    isModalOpen: boolean;

    // Actions
    addConflict: (conflict: ConflictData) => void;
    resolveConflict: (id: string, tableName?: string) => void;
    clearConflicts: () => void;
}

export const useSyncConflictStore = create<SyncConflictStore>((set) => ({
    conflicts: [],
    isModalOpen: false,

    addConflict: (conflict) =>
        set((state) => {
            const existing = state.conflicts.some(
                c => c.id === conflict.id && c.tableName === conflict.tableName
            );
            if (existing) {
                return state;
            }
            return {
                conflicts: [...state.conflicts, conflict],
                isModalOpen: true,
            };
        }),

    resolveConflict: (id, tableName) =>
        set((state) => {
            const remainingConflicts = state.conflicts.filter((c) => {
                if (tableName) {
                    return !(c.id === id && c.tableName === tableName);
                }
                return c.id !== id;
            });
            return {
                conflicts: remainingConflicts,
                isModalOpen: remainingConflicts.length > 0,
            };
        }),

    clearConflicts: () =>
        set({
            conflicts: [],
            isModalOpen: false,
        }),
}));
