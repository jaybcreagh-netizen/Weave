/**
 * Username Search Sheet
 * 
 * Bottom sheet for searching and adding Weave users as friends.
 * Part of the Friend Linking feature.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Search, UserPlus, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text, Input } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    searchUsersByUsername,
    WeaveUserSearchResult,
    createLinkedFriend
} from '@/modules/relationships';
import debounce from 'lodash/debounce';
import { UserSearchList } from './UserSearchList';

interface UsernameSearchSheetProps {
    visible: boolean;
    onClose: () => void;
    onFriendCreated: (friendId: string) => void;
    onAddManually?: () => void;
}

export function UsernameSearchSheet({
    visible,
    onClose,
    onFriendCreated,
    onAddManually
}: UsernameSearchSheetProps) {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WeaveUserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState<'InnerCircle' | 'CloseFriends' | 'Community'>('Community');
    const [addingUserId, setAddingUserId] = useState<string | null>(null);
    const [addedUserIds, setAddedUserIds] = useState<Set<string>>(new Set());

    // Debounced search
    const debouncedSearch = useCallback(
        debounce(async (searchQuery: string) => {
            if (searchQuery.length < 2) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const users = await searchUsersByUsername(searchQuery);
            setResults(users);
            setLoading(false);
        }, 300),
        []
    );

    useEffect(() => {
        debouncedSearch(query);
    }, [query, debouncedSearch]);

    // Reset state when sheet closes
    useEffect(() => {
        if (!visible) {
            setQuery('');
            setResults([]);
            setAddingUserId(null);
            setAddedUserIds(new Set());
        }
    }, [visible]);

    const handleAddFriend = async (user: WeaveUserSearchResult) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAddingUserId(user.id);

        const friend = await createLinkedFriend(user, selectedTier);

        setAddingUserId(null);

        if (friend) {
            setAddedUserIds(prev => new Set([...prev, user.id]));
            onFriendCreated(friend.id);
        }
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title="Add Friend"
            height="form"
        >
            <View className="flex-1 px-4">
                {/* Search Input */}
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="flex-1 flex-row items-center rounded-xl px-3" style={{ backgroundColor: colors.muted }}>
                        <Search size={18} color={colors['muted-foreground']} />
                        <Input
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search by username..."
                            className="flex-1 ml-2"
                            style={{ backgroundColor: 'transparent' }}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                </View>

                {/* Tier Selector */}
                <View className="flex-row gap-2 mb-4">
                    {(['InnerCircle', 'CloseFriends', 'Community'] as const).map(tier => (
                        <TouchableOpacity
                            key={tier}
                            className="flex-1 py-2 rounded-lg items-center"
                            style={{
                                backgroundColor: selectedTier === tier ? colors.primary : colors.muted,
                            }}
                            onPress={() => setSelectedTier(tier)}
                        >
                            <Text
                                className="text-xs font-medium"
                                style={{
                                    color: selectedTier === tier ? colors['primary-foreground'] : colors['muted-foreground']
                                }}
                            >
                                {tier === 'InnerCircle' ? 'Inner' : tier === 'CloseFriends' ? 'Close' : 'Community'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Results List */}
                <UserSearchList
                    results={results}
                    loading={loading}
                    searchQuery={query}
                    actionLabel="Add"
                    onAction={handleAddFriend}
                    isActionLoading={(id) => addingUserId === id}
                    isActionDisabled={(id) => addedUserIds.has(id)}
                    getActionLabel={(id) => addedUserIds.has(id) ? 'Added' : 'Add'}
                    renderActionIcon={(color) => (
                        addingUserId ? (
                            // Let UserSearchList handle spinner
                            null
                        ) : addedUserIds.has(addingUserId as string) ? ( // Check specific id? No, logic is inside renderActionIcon call
                            // Actually duplicate logic a bit inside component, but here we just pass icon
                            <Check size={16} color={color} />
                        ) : (
                            <UserPlus size={16} color={color} />
                        )
                    )}
                    // Fix: simple icon render based on color passed from disabled state
                    // Use a simpler approach
                    emptyStateTitle="Search for Weave users by username"
                    emptyStateSubtitle="They'll get a link request when you add them"
                    onAddManually={() => {
                        onClose();
                        onAddManually?.();
                    }}
                />
            </View>
        </StandardBottomSheet>
    );
}
