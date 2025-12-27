/**
 * Username Search Sheet
 * 
 * Bottom sheet for searching and adding Weave users as friends.
 * Part of the Friend Linking feature.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Search, UserPlus, Link, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text, Input } from '@/shared/ui';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    searchUsersByUsername,
    WeaveUserSearchResult,
    createLinkedFriend
} from '@/modules/relationships/services/friend-linking.service';
import debounce from 'lodash/debounce';

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

    const renderUserItem = ({ item }: { item: WeaveUserSearchResult }) => {
        const isAdding = addingUserId === item.id;
        const isAdded = addedUserIds.has(item.id);

        return (
            <View
                className="flex-row items-center p-3 rounded-xl mb-2"
                style={{ backgroundColor: colors.card }}
            >
                {/* Profile Photo */}
                {item.photoUrl ? (
                    <CachedImage
                        source={{ uri: item.photoUrl }}
                        style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                ) : (
                    <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text className="text-lg font-bold" style={{ color: colors['muted-foreground'] }}>
                            {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* User Info */}
                <View className="flex-1 ml-3">
                    <Text className="font-semibold" style={{ color: colors.foreground }}>
                        {item.displayName}
                    </Text>
                    <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
                        @{item.username}
                    </Text>
                </View>

                {/* Add Button */}
                <TouchableOpacity
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2"
                    style={{
                        backgroundColor: isAdded ? colors.primary : colors.muted,
                        opacity: isAdding ? 0.5 : 1
                    }}
                    onPress={() => handleAddFriend(item)}
                    disabled={isAdding || isAdded}
                >
                    {isAdding ? (
                        <ActivityIndicator size="small" color={colors.foreground} />
                    ) : isAdded ? (
                        <>
                            <Check size={16} color={colors['primary-foreground']} />
                            <Text className="font-medium" style={{ color: colors['primary-foreground'] }}>
                                Added
                            </Text>
                        </>
                    ) : (
                        <>
                            <UserPlus size={16} color={colors.foreground} />
                            <Text className="font-medium" style={{ color: colors.foreground }}>
                                Add
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
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

                {/* Results */}
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : results.length > 0 ? (
                    <FlatList
                        data={results}
                        keyExtractor={item => item.id}
                        renderItem={renderUserItem}
                        showsVerticalScrollIndicator={false}
                    />
                ) : query.length >= 2 ? (
                    <View className="flex-1 items-center justify-center">
                        <Link size={40} color={colors['muted-foreground']} />
                        <Text className="text-center mt-3" style={{ color: colors['muted-foreground'] }}>
                            No users found matching "{query}"
                        </Text>
                    </View>
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Search size={40} color={colors['muted-foreground']} />
                        <Text className="text-center mt-3" style={{ color: colors['muted-foreground'] }}>
                            Search for Weave users by username
                        </Text>
                        <Text className="text-center text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
                            They'll get a link request when you add them
                        </Text>

                        {/* Manual fallback */}
                        {onAddManually && (
                            <>
                                <View className="flex-row items-center gap-3 mt-6 mb-2">
                                    <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                                    <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>or</Text>
                                    <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                                </View>
                                <TouchableOpacity
                                    className="py-2"
                                    onPress={() => {
                                        onClose();
                                        onAddManually();
                                    }}
                                >
                                    <Text className="text-center" style={{ color: colors.primary }}>
                                        + Add manually without searching
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        </StandardBottomSheet>
    );
}
