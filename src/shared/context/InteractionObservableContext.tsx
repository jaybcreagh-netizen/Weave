/**
 * InteractionObservableContext
 * 
 * Centralized observable for interactions data to prevent duplicate subscriptions.
 * Similar to FriendsObservableContext, this provides a single subscription that
 * all components share, with debouncing to prevent cascade re-renders.
 * 
 * This is a key optimization for database write performance - without it,
 * each write to the interactions table triggers 6+ separate observable updates
 * that each cause React re-renders, blocking the JS thread for ~2 seconds.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import { debounceTime } from 'rxjs/operators';

interface InteractionContextValue {
    interactions: Interaction[];
    isLoading: boolean;
    // Pre-computed filtered lists for common access patterns
    completedInteractions: Interaction[];
    plannedInteractions: Interaction[];
    recentInteractions: Interaction[]; // Last 30 days
    // Counts for quick access
    counts: {
        total: number;
        completed: number;
        planned: number;
    };
}

const InteractionObservableContext = createContext<InteractionContextValue | null>(null);

// Default debounce time in ms
// Higher = less re-renders but more stale data
// Lower = more responsive but more re-renders
const DEBOUNCE_MS = 100;

export function InteractionObservableProvider({ children }: { children: React.ReactNode }) {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Single subscription to interactions table with debouncing
    useEffect(() => {
        const observable = database
            .get<Interaction>('interactions')
            .query(Q.sortBy('interaction_date', Q.desc))
            .observe();

        // Apply debouncing to prevent cascade re-renders
        const subscription = observable
            .pipe(debounceTime(DEBOUNCE_MS))
            .subscribe({
                next: (allInteractions) => {
                    setInteractions(allInteractions);
                    setIsLoading(false);
                },
                error: (err) => {
                    console.error('[InteractionObservable] Failed to observe interactions:', err);
                    setIsLoading(false);
                }
            });

        return () => subscription.unsubscribe();
    }, []);

    // Memoized filtered lists - computed once per interactions update
    const { completedInteractions, plannedInteractions, recentInteractions, counts } = useMemo(() => {
        const completed = interactions.filter(i => i.status === 'completed');
        const planned = interactions.filter(
            i => i.status === 'planned' && new Date(i.interactionDate) >= new Date()
        );

        // Last 30 days for "recent"
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recent = completed.filter(i => new Date(i.interactionDate) >= thirtyDaysAgo);

        return {
            completedInteractions: completed,
            plannedInteractions: planned,
            recentInteractions: recent,
            counts: {
                total: interactions.length,
                completed: completed.length,
                planned: planned.length,
            },
        };
    }, [interactions]);

    const value = useMemo<InteractionContextValue>(() => ({
        interactions,
        isLoading,
        completedInteractions,
        plannedInteractions,
        recentInteractions,
        counts,
    }), [interactions, isLoading, completedInteractions, plannedInteractions, recentInteractions, counts]);

    return (
        <InteractionObservableContext.Provider value={value}>
            {children}
        </InteractionObservableContext.Provider>
    );
}

/**
 * Hook to access centralized interactions observable.
 * Use this instead of direct database.get('interactions').query().observe()
 */
export function useInteractionObservable(): InteractionContextValue {
    const context = useContext(InteractionObservableContext);
    if (!context) {
        throw new Error('useInteractionObservable must be used within InteractionObservableProvider');
    }
    return context;
}

/**
 * Selector hook for just completed interactions
 */
export function useCompletedInteractions(): Interaction[] {
    return useInteractionObservable().completedInteractions;
}

/**
 * Selector hook for just planned interactions
 */
export function usePlannedInteractions(): Interaction[] {
    return useInteractionObservable().plannedInteractions;
}

/**
 * Selector hook for recent interactions (last 30 days)
 */
export function useRecentInteractions(): Interaction[] {
    return useInteractionObservable().recentInteractions;
}

/**
 * Selector hook for interaction counts only
 */
export function useInteractionCounts() {
    return useInteractionObservable().counts;
}

/**
 * Helper to get an interaction by ID from the cached list
 */
export function useInteractionById(id: string): Interaction | undefined {
    const { interactions } = useInteractionObservable();
    return useMemo(() => interactions.find(i => i.id === id), [interactions, id]);
}
