import type { Model } from '@nozbe/watermelondb';

export interface ConflictData {
    id: string;
    tableName: string;
    localRecord: Model;
    serverRecord: any;
    resolve: (strategy: 'keep_local' | 'keep_server') => Promise<void>;
}

type ConflictListener = (conflict: ConflictData) => void;

class SyncConflictService {
    private listeners: ConflictListener[] = [];

    // Method for SyncEngine to report a conflict
    reportConflict(conflict: ConflictData) {
        this.notifyListeners(conflict);
    }

    // Subscribe to conflict events
    onConflict(listener: ConflictListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(conflict: ConflictData) {
        this.listeners.forEach(listener => listener(conflict));
    }
}

export const syncConflictService = new SyncConflictService();
