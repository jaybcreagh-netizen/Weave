import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { X, Plus, Users, ChevronRight, Trash2, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';
import Group from '@/db/models/Group';
import { groupService, GroupSuggestion } from '@/modules/groups';
import { GroupManagerModal } from './GroupManagerModal';

interface GroupListModalProps {
    visible: boolean;
    onClose: () => void;
}

export function GroupListModal({ visible, onClose }: GroupListModalProps) {
    const { colors } = useTheme();
    const [groups, setGroups] = useState<Group[]>([]);
    const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
    const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);
    const [initialData, setInitialData] = useState<{ name: string; memberIds: string[] } | undefined>(undefined);
    const [isManagerVisible, setIsManagerVisible] = useState(false);

    const loadGroups = async () => {
        const manualGroups = await groupService.getManualGroups();
        setGroups(manualGroups);

        const smartSuggestions = await groupService.detectSmartGroups();
        setSuggestions(smartSuggestions);
    };

    useEffect(() => {
        if (visible) {
            loadGroups();
        }
    }, [visible]);

    const handleEditGroup = (group: Group) => {
        setEditingGroup(group);
        setIsManagerVisible(true);
    };

    const handleCreateGroup = () => {
        setEditingGroup(undefined);
        setInitialData(undefined);
        setIsManagerVisible(true);
    };

    const handleCreateFromSuggestion = (suggestion: GroupSuggestion) => {
        setEditingGroup(undefined);
        setInitialData({
            name: suggestion.suggestedName,
            memberIds: suggestion.friendIds
        });
        setIsManagerVisible(true);
    };

    const handleDeleteGroup = async (group: Group) => {
        Alert.alert(
            'Delete Group',
            `Are you sure you want to delete "${group.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await groupService.deleteGroup(group.id);
                            loadGroups();
                        } catch (error) {
                            console.error('Error deleting group:', error);
                            Alert.alert('Error', 'Failed to delete group.');
                        }
                    }
                }
            ]
        );
    };

    const renderGroupItem = ({ item }: { item: Group }) => {
        return (
            <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b"
                style={{ borderColor: colors.border }}
                onPress={() => handleEditGroup(item)}
            >
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.muted }}>
                        <Users size={20} color={colors.primary} />
                    </View>
                    <View>
                        <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
                            {item.name}
                        </Text>
                        <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>
                            Tap to edit
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => handleDeleteGroup(item)} className="p-2">
                        <Trash2 size={20} color={colors.destructive} />
                    </TouchableOpacity>
                    <ChevronRight size={20} color={colors['muted-foreground']} />
                </View>
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
                        Manage Groups
                    </Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    className="flex-row items-center p-4 border-b"
                    style={{ borderColor: colors.border }}
                    onPress={handleCreateGroup}
                >
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                        <Plus size={20} color={colors.background} />
                    </View>
                    <Text className="font-inter-medium text-base" style={{ color: colors.primary }}>
                        Create New Group
                    </Text>
                </TouchableOpacity>

                <FlatList
                    data={groups}
                    renderItem={renderGroupItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListHeaderComponent={
                        suggestions.length > 0 ? (
                            <View className="mb-4">
                                <View className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/50">
                                    <View className="flex-row items-center gap-2 mb-1">
                                        <Sparkles size={16} color={colors.primary} />
                                        <Text className="font-inter-semibold text-sm" style={{ color: colors.primary }}>
                                            Suggested Groups
                                        </Text>
                                    </View>
                                    <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>
                                        Based on your weaving patterns
                                    </Text>
                                </View>
                                {suggestions.map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        className="flex-row items-center justify-between p-4 border-b border-indigo-50 dark:border-indigo-900/10"
                                        onPress={() => handleCreateFromSuggestion(suggestion)}
                                    >
                                        <View className="flex-1 mr-4">
                                            <Text className="font-inter-medium text-base mb-1" style={{ color: colors.foreground }}>
                                                {suggestion.suggestedName}
                                            </Text>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>
                                                    {suggestion.interactionCount} weaves together
                                                </Text>
                                                <View className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                                                    <Text className="font-inter-medium text-[10px] text-green-700 dark:text-green-300">
                                                        {(suggestion.confidence * 100).toFixed(0)}% Confidence
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 items-center justify-center">
                                            <Plus size={16} color={colors.primary} />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View className="items-center py-12 px-10">
                            <Text className="text-center mb-2" style={{ color: colors.foreground }}>No groups yet</Text>
                            <Text className="text-center text-sm" style={{ color: colors['muted-foreground'] }}>
                                Create groups to easily organize your friends.
                            </Text>
                        </View>
                    }
                />

                <GroupManagerModal
                    visible={isManagerVisible}
                    onClose={() => setIsManagerVisible(false)}
                    groupToEdit={editingGroup}
                    initialData={initialData}
                    onGroupSaved={loadGroups}
                />
            </View>
        </CustomBottomSheet>
    );
}
