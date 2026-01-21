/**
 * Weave User Search Modal
 * 
 * A focused, center-screen popup for searching the Weave network.
 * addresses feedback about search "breaking" the main sheet UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Search, UserPlus, Check } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text, Input } from '@/shared/ui';
import {
    searchUsersByUsername,
    WeaveUserSearchResult,
    createLinkedFriend
} from '@/modules/relationships';
import debounce from 'lodash/debounce';
import * as Haptics from 'expo-haptics';
import { UserSearchList } from './UserSearchList';

interface WeaveUserSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onFriendCreated: (friendId: string) => void;
    onSwitchToManual: () => void;
}

export function WeaveUserSearchModal({
    visible,
    onClose,
    onFriendCreated,
    onSwitchToManual
}: WeaveUserSearchModalProps) {
    const { colors, isDarkMode } = useTheme();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WeaveUserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState<'InnerCircle' | 'CloseFriends' | 'Community'>('Community');
    const [addingUserId, setAddingUserId] = useState<string | null>(null);
    const [addedUserIds, setAddedUserIds] = useState<Set<string>>(new Set());

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!visible) {
            setQuery('');
            setResults([]);
            setAddingUserId(null);
            setAddedUserIds(new Set());
        }
    }, [visible]);

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

    const handleAddFriend = async (user: WeaveUserSearchResult) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAddingUserId(user.id);

        const friend = await createLinkedFriend(user, selectedTier);

        setAddingUserId(null);

        if (friend) {
            setAddedUserIds(prev => new Set([...prev, user.id]));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Should we close immediately? 
            // Often nice to let them add multiple or confirm. 
            // Previous behavior was close. Let's close after a tiny delay or just notify.
            // Dashboard expects navigation.
            onFriendCreated(friend.id);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <BlurView
                intensity={Platform.OS === 'ios' ? 25 : 100}
                tint={isDarkMode ? 'dark' : 'light'}
                className="flex-1 justify-center items-center p-4 bg-black/20"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center items-center w-full"
                    pointerEvents="box-none"
                    // Add offset to prevent excessive pushing if needed
                    keyboardVerticalOffset={Platform.OS === 'ios' ? -100 : 0}
                >
                    <View
                        className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                        style={{
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                            maxHeight: '60%', // Reduced from 80% to fit better above keyboard
                            height: 500, // Reduced target height
                        }}
                    >
                        {/* Header */}
                        <View className="flex-row items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
                            <Text variant="h4" weight="bold">Find on Weave</Text>
                            <TouchableOpacity
                                onPress={onClose}
                                className="w-8 h-8 items-center justify-center rounded-full"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <X size={18} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-1 p-4">
                            {/* Search Input */}
                            <View className="flex-row items-center rounded-xl px-3 mb-4" style={{ backgroundColor: colors.muted, height: 48 }}>
                                <Search size={20} color={colors['muted-foreground']} />
                                <Input
                                    value={query}
                                    onChangeText={setQuery}
                                    placeholder="Search username..."
                                    className="flex-1 ml-2 text-base"
                                    style={{ backgroundColor: 'transparent', height: 48 }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoFocus={true} // Auto focus when modal opens
                                />
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
                            <View className="flex-1">
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
                                        <UserPlus size={16} color={color} />
                                    )}
                                    emptyStateTitle="Search Weave Context"
                                    emptyStateSubtitle="Find friends by their username"
                                    noResultsText={`No user found matching "${query}"`}
                                // Removed onAddManually prop
                                />
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Modal>
    );
}
