import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, TextInput } from 'react-native';
import { CheckCircle, Circle, Search, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { useFriends } from '@/modules/relationships';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';

interface FriendSelectorProps {
    visible: boolean;
    onClose: () => void;
    initialFriendId?: string;
    selectedFriends: FriendModel[];
    onSelectionChange: (friends: FriendModel[]) => void;
}

export function FriendSelector({
    visible,
    onClose,
    initialFriendId,
    selectedFriends,
    onSelectionChange
}: FriendSelectorProps) {
    const { colors, isDarkMode } = useTheme();
    const allFriends = useFriends();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter friends based on search query
    const filteredFriends = (allFriends || []).filter(friend =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleFriendSelection = (friend: FriendModel) => {
        const isSelected = selectedFriends.some(f => f.id === friend.id);

        if (isSelected) {
            // Prevent deselecting the initial friend if provided
            if (initialFriendId && friend.id === initialFriendId) {
                return;
            }
            onSelectionChange(selectedFriends.filter(f => f.id !== friend.id));
        } else {
            onSelectionChange([...selectedFriends, friend]);
        }
    };

    const renderFriendItem = ({ item }: { item: FriendModel }) => {
        const isSelected = selectedFriends.some(f => f.id === item.id);
        const isInitial = initialFriendId === item.id;

        return (
            <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b"
                style={{ borderColor: colors.border }}
                onPress={() => toggleFriendSelection(item)}
                disabled={isInitial}
            >
                <View className="flex-row items-center gap-3">
                    {/* Avatar placeholder if needed, for now just name */}
                    <View>
                        <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
                            {item.name}
                        </Text>
                        {isInitial && (
                            <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>
                                (Profile Owner)
                            </Text>
                        )}
                    </View>
                </View>

                {isSelected ? (
                    <CheckCircle size={20} color={isInitial ? colors['muted-foreground'] : colors.primary} />
                ) : (
                    <Circle size={20} color={colors['muted-foreground']} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <CustomBottomSheet
            visible={visible}
            onClose={onClose}
            snapPoints={['90%']}
        >
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row justify-between items-center p-5 border-b" style={{ borderColor: colors.border }}>
                    <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                        Add Friends
                    </Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View className="px-5 py-3">
                    <View
                        className="flex-row items-center px-4 py-3 rounded-xl"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Search size={18} color={colors['muted-foreground']} />
                        <TextInput
                            className="flex-1 ml-3 font-inter-regular text-base"
                            style={{ color: colors.foreground }}
                            placeholder="Search friends..."
                            placeholderTextColor={colors['muted-foreground']}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={colors['muted-foreground']} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Friends List */}
                <FlatList
                    data={filteredFriends}
                    renderItem={renderFriendItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <Text style={{ color: colors['muted-foreground'] }}>No friends found</Text>
                        </View>
                    }
                />

                {/* Done Button */}
                <View
                    className="absolute bottom-0 left-0 right-0 p-5 border-t"
                    style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        paddingBottom: 30 // Safe area padding
                    }}
                >
                    <TouchableOpacity
                        onPress={onClose}
                        className="py-4 rounded-xl items-center"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <Text className="font-inter-semibold text-base" style={{ color: colors.background }}>
                            Done ({selectedFriends.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </CustomBottomSheet>
    );
}
