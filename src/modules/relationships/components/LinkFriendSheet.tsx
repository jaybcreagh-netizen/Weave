/**
 * Link Friend Sheet
 * 
 * Sheet for searching and linking an existing friend to a Weave user.
 * Similar to UsernameSearchSheet but for linking rather than creating.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Search, Link, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text, Input } from '@/shared/ui';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    searchUsersByUsername,
    WeaveUserSearchResult,
    sendLinkRequest
} from '@/modules/relationships/services/friend-linking.service';
import debounce from 'lodash/debounce';

interface LinkFriendSheetProps {
    visible: boolean;
    friendId: string;
    friendName: string;
    onClose: () => void;
    onLinked: () => void;
}

export function LinkFriendSheet({
    visible,
    friendId,
    friendName,
    onClose,
    onLinked
}: LinkFriendSheetProps) {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WeaveUserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [linkingUserId, setLinkingUserId] = useState<string | null>(null);

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
            setLinkingUserId(null);
        }
    }, [visible]);

    const handleLink = async (user: WeaveUserSearchResult) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLinkingUserId(user.id);

        const success = await sendLinkRequest(friendId, user.id);

        setLinkingUserId(null);

        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onLinked();
            onClose();
        }
    };

    const renderUserItem = ({ item }: { item: WeaveUserSearchResult }) => {
        const isLinking = linkingUserId === item.id;

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

                {/* Link Button */}
                <TouchableOpacity
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2"
                    style={{
                        backgroundColor: colors.primary,
                        opacity: isLinking ? 0.5 : 1
                    }}
                    onPress={() => handleLink(item)}
                    disabled={isLinking}
                >
                    {isLinking ? (
                        <ActivityIndicator size="small" color={colors['primary-foreground']} />
                    ) : (
                        <>
                            <Link size={16} color={colors['primary-foreground']} />
                            <Text className="font-medium" style={{ color: colors['primary-foreground'] }}>
                                Link
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
            title={`Link ${friendName}`}
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
                            Search for {friendName}'s Weave account
                        </Text>
                        <Text className="text-center text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
                            They'll get a link request to connect
                        </Text>
                    </View>
                )}
            </View>
        </StandardBottomSheet>
    );
}
