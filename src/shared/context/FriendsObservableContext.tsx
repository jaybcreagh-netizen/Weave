/**
 * FriendsObservableContext
 * 
 * Centralized observable for friends data to prevent duplicate subscriptions.
 * Multiple components were independently subscribing to friends.query().observe(),
 * causing performance issues when switching tabs. This context provides a single
 * subscription that all components share.
 * 
 * OPTIMIZATION: Also prefetches profile images when friends load for instant display.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { Image } from 'expo-image';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

interface FriendsContextValue {
    friends: FriendModel[];
    isLoading: boolean;
    // Pre-computed tier groups for common access patterns
    innerCircle: FriendModel[];
    closeFriends: FriendModel[];
    community: FriendModel[];
    // Counts for quick access
    counts: {
        total: number;
        inner: number;
        close: number;
        community: number;
    };
}

const FriendsObservableContext = createContext<FriendsContextValue | null>(null);

export function FriendsObservableProvider({ children }: { children: React.ReactNode }) {
    const [friends, setFriends] = useState<FriendModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const prefetchedUrls = useRef<Set<string>>(new Set());

    // Single subscription to friends table
    useEffect(() => {
        const subscription = database
            .get<FriendModel>('friends')
            .query()
            .observe()
            .subscribe((allFriends) => {
                setFriends(allFriends);
                setIsLoading(false);
            });

        return () => subscription.unsubscribe();
    }, []);

    // Prefetch profile images when friends change
    useEffect(() => {
        // Skip prefetching if already handled by DataInitializer (simple check)
        if (friends.length === 0) return;

        const urlsToPrefetch: string[] = [];

        for (const friend of friends) {
            const url = friend.photoUrl;
            if (url && !prefetchedUrls.current.has(url)) {
                urlsToPrefetch.push(url);
                prefetchedUrls.current.add(url);
            }
        }

        if (urlsToPrefetch.length > 0) {
            // Prefetch in batches to avoid overwhelming the network
            // Higher priority for Inner Circle friends (first 5)
            const priorityUrls = urlsToPrefetch.slice(0, 10);
            const remainingUrls = urlsToPrefetch.slice(10);

            // Prefetch priority images immediately
            Image.prefetch(priorityUrls, 'memory-disk').catch(() => {
                // Silently fail - images will load normally when rendered
            });

            // Prefetch remaining images with a slight delay
            if (remainingUrls.length > 0) {
                setTimeout(() => {
                    Image.prefetch(remainingUrls, 'memory-disk').catch(() => { });
                }, 500);
            }
        }
    }, [friends]);

    // Memoized tier groups - computed once per friends update
    const { innerCircle, closeFriends, community, counts } = useMemo(() => {
        const inner = friends.filter(f => f.dunbarTier === 'InnerCircle');
        const close = friends.filter(f => f.dunbarTier === 'CloseFriends');
        const comm = friends.filter(f => f.dunbarTier === 'Community');

        return {
            innerCircle: inner,
            closeFriends: close,
            community: comm,
            counts: {
                total: friends.length,
                inner: inner.length,
                close: close.length,
                community: comm.length,
            },
        };
    }, [friends]);

    const value = useMemo<FriendsContextValue>(() => ({
        friends,
        isLoading,
        innerCircle,
        closeFriends,
        community,
        counts,
    }), [friends, isLoading, innerCircle, closeFriends, community, counts]);

    return (
        <FriendsObservableContext.Provider value={value}>
            {children}
        </FriendsObservableContext.Provider>
    );
}

/**
 * Hook to access centralized friends observable.
 * Use this instead of withObservables or direct database.get('friends').query().observe()
 */
export function useFriendsObservable(): FriendsContextValue {
    const context = useContext(FriendsObservableContext);
    if (!context) {
        throw new Error('useFriendsObservable must be used within FriendsObservableProvider');
    }
    return context;
}

/**
 * Selector hook for just the friends array (minimizes re-renders for components
 * that don't need tier groupings)
 */
export function useFriends(): FriendModel[] {
    return useFriendsObservable().friends;
}

/**
 * Selector hook for friend counts only
 */
export function useFriendCounts() {
    return useFriendsObservable().counts;
}
