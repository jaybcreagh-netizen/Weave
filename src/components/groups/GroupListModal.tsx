import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { X, Plus, Users, ChevronRight, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';
import Group from '@/db/models/Group';
import { groupService } from '@/modules/groups/services/group.service';
import { GroupManagerModal } from './GroupManagerModal';

interface GroupListModalProps {
    visible: boolean;
    onClose: () => void;
}

export function GroupListModal({ visible, onClose }: GroupListModalProps) {
    const { colors } = useTheme();
    const [groups, setGroups] = useState<Group[]>([]);
    const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);
    const [isManagerVisible, setIsManagerVisible] = useState(false);

    const loadGroups = async () => {
        const manualGroups = await groupService.getManualGroups();
        setGroups(manualGroups);
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

                {/* Groups List */}
                <FlatList
                    data={groups}
                    renderItem={renderGroupItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 100 }}
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
                    onGroupSaved={loadGroups}
                />
            </View>
        </CustomBottomSheet>
    );
}
