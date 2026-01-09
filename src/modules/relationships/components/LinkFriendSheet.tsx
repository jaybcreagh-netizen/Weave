/**
 * Link Friend Sheet
 * 
 * Sheet for searching and linking an existing friend to a Weave user.
 * Similar to UsernameSearchSheet but for linking rather than creating.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Search, Link } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Input } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    searchUsersByUsername,
    WeaveUserSearchResult,
    sendLinkRequest
} from '@/modules/relationships';
import debounce from 'lodash/debounce';
import { UserSearchList } from './UserSearchList';

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

        const result = await sendLinkRequest(friendId, user.id);

        setLinkingUserId(null);

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onLinked();
            onClose();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Link Failed", result.error || "Could not send link request.");
        }
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
                <UserSearchList
                    results={results}
                    loading={loading}
                    searchQuery={query}
                    actionLabel="Link"
                    onAction={handleLink}
                    isActionLoading={(id) => linkingUserId === id}
                    renderActionIcon={(color) => <Link size={16} color={color} />}
                    emptyStateTitle={`Search for ${friendName}'s Weave account`}
                    emptyStateSubtitle="They'll get a link request to connect"
                />
            </View>
        </StandardBottomSheet>
    );
}
