import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { syncConflictService, ConflictData } from '../services/sync-conflict.service';

interface SyncConflictContextType {
    conflicts: ConflictData[];
    currentConflict: ConflictData | null;
    isModalOpen: boolean;
    resolveConflict: (id: string) => void;
    clearConflicts: () => void;
}

const SyncConflictContext = createContext<SyncConflictContextType | undefined>(undefined);

export function SyncConflictProvider({ children }: { children: ReactNode }) {
    const [conflicts, setConflicts] = useState<ConflictData[]>([]);

    useEffect(() => {
        // Subscribe to conflicts from the service
        const unsubscribe = syncConflictService.onConflict((conflict) => {
            setConflicts((prev) => {
                // Avoid duplicates
                if (prev.some(c => c.id === conflict.id)) return prev;
                return [...prev, conflict];
            });
        });

        return unsubscribe;
    }, []);

    const resolveConflict = (id: string) => {
        setConflicts((prev) => prev.filter((c) => c.id !== id));
    };

    const clearConflicts = () => {
        setConflicts([]);
    };

    const currentConflict = conflicts.length > 0 ? conflicts[0] : null;
    const isModalOpen = conflicts.length > 0;

    const value = {
        conflicts,
        currentConflict,
        isModalOpen,
        resolveConflict,
        clearConflicts,
    };

    return (
        <SyncConflictContext.Provider value={value}>
            {children}
        </SyncConflictContext.Provider>
    );
}

export function useSyncConflict() {
    const context = useContext(SyncConflictContext);
    if (context === undefined) {
        throw new Error('useSyncConflict must be used within a SyncConflictProvider');
    }
    return context;
}
