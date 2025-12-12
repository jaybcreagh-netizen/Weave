/**
 * useFriendSelector Hook
 * 
 * Shared hook for friend selection across Journal components.
 * Consolidates friend loading and selection logic from:
 * - QuickCaptureSheet
 * - GuidedReflectionModal  
 * - JournalEntryModal
 */

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import * as Haptics from 'expo-haptics';

export interface FriendChip {
    id: string;
    name: string;
}

export interface UseFriendSelectorOptions {
    /** Pre-selected friend IDs */
    initialFriendIds?: string[];
    /** Only include non-dormant friends */
    excludeDormant?: boolean;
}

export interface UseFriendSelectorReturn {
    /** All available friends */
    friends: FriendModel[];
    /** Currently selected friends as chips */
    selectedFriends: FriendChip[];
    /** IDs of selected friends */
    selectedFriendIds: string[];
    /** Loading state */
    loading: boolean;
    /** Toggle a friend's selection */
    toggleFriend: (friend: FriendModel) => void;
    /** Set selected friends directly */
    setSelectedFriends: (friends: FriendChip[]) => void;
    /** Clear all selections */
    clearSelection: () => void;
    /** Check if a friend is selected */
    isSelected: (friendId: string) => boolean;
}

export function useFriendSelector(
    options: UseFriendSelectorOptions = {}
): UseFriendSelectorReturn {
    const { initialFriendIds = [], excludeDormant = true } = options;

    const [friends, setFriends] = useState<FriendModel[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<FriendChip[]>([]);
    const [loading, setLoading] = useState(true);

    // Load friends on mount
    useEffect(() => {
        loadFriends();
    }, [excludeDormant]);

    // Handle initial friend IDs once friends are loaded
    useEffect(() => {
        if (initialFriendIds.length > 0 && friends.length > 0) {
            const initialChips = initialFriendIds
                .map(id => {
                    const friend = friends.find(f => f.id === id);
                    return friend ? { id: friend.id, name: friend.name } : null;
                })
                .filter((chip): chip is FriendChip => chip !== null);

            if (initialChips.length > 0) {
                setSelectedFriends(initialChips);
            }
        }
    }, [initialFriendIds, friends]);

    const loadFriends = async () => {
        setLoading(true);
        try {
            const conditions = excludeDormant
                ? [Q.where('is_dormant', false), Q.sortBy('name', Q.asc)]
                : [Q.sortBy('name', Q.asc)];

            const allFriends = await database
                .get<FriendModel>('friends')
                .query(...conditions)
                .fetch();

            setFriends(allFriends);
        } catch (error) {
            console.error('[useFriendSelector] Error loading friends:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleFriend = useCallback((friend: FriendModel) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setSelectedFriends(prev => {
            const exists = prev.some(f => f.id === friend.id);
            if (exists) {
                return prev.filter(f => f.id !== friend.id);
            } else {
                return [...prev, { id: friend.id, name: friend.name }];
            }
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedFriends([]);
    }, []);

    const isSelected = useCallback(
        (friendId: string) => selectedFriends.some(f => f.id === friendId),
        [selectedFriends]
    );

    return {
        friends,
        selectedFriends,
        selectedFriendIds: selectedFriends.map(f => f.id),
        loading,
        toggleFriend,
        setSelectedFriends,
        clearSelection,
        isSelected,
    };
}

export default useFriendSelector;
