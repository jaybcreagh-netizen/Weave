import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import FriendModel from '@/db/models/Friend';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { groupService } from '@/modules/groups';
import Group from '@/db/models/Group';

interface GroupManagerModalProps {
    visible: boolean;
    onClose: () => void;
    groupToEdit?: Group; // If provided, we are editing
    initialData?: { name: string; memberIds: string[] }; // For pre-filling (e.g. from suggestions)
    onGroupSaved: () => void;
}

export function GroupManagerModal({
    visible,
    onClose,
    groupToEdit,
    initialData,
    onGroupSaved,
}: GroupManagerModalProps) {
    const { colors } = useTheme();
    const [allFriends, setAllFriends] = useState<FriendModel[]>([]);
    const [name, setName] = useState('');
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const subscription = database
            .get<FriendModel>('friends')
            .query(Q.sortBy('created_at', Q.desc))
            .observe()
            .subscribe(setAllFriends);

        return () => subscription.unsubscribe();
    }, []);

    // Initialize form when groupToEdit or initialData changes
    useEffect(() => {
        if (groupToEdit) {
            setName(groupToEdit.name);
            // Fetch members
            groupToEdit.members.fetch().then((members: any[]) => {
                setSelectedFriendIds(members.map((m: any) => m.friendId));
            });
        } else if (initialData) {
            setName(initialData.name);
            setSelectedFriendIds(initialData.memberIds);
        } else {
            setName('');
            setSelectedFriendIds([]);
        }
    }, [groupToEdit, initialData, visible]);

    const toggleFriend = (friendId: string) => {
        if (selectedFriendIds.includes(friendId)) {
            setSelectedFriendIds(prev => prev.filter(id => id !== friendId));
        } else {
            setSelectedFriendIds(prev => [...prev, friendId]);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Name', 'Please enter a name for the group.');
            return;
        }
        if (selectedFriendIds.length === 0) {
            Alert.alert('No Friends', 'Please select at least one friend.');
            return;
        }

        setIsSaving(true);
        try {
            if (groupToEdit) {
                await groupService.updateGroup(groupToEdit.id, name, selectedFriendIds);
            } else {
                await groupService.createGroup(name, selectedFriendIds);
            }
            onGroupSaved();
            onClose();
        } catch (error) {
            console.error('Error saving group:', error);
            Alert.alert('Error', 'Failed to save group.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!groupToEdit) return;

        Alert.alert(
            'Delete Group',
            `Are you sure you want to delete "${groupToEdit.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await groupService.deleteGroup(groupToEdit.id);
                            onGroupSaved();
                            onClose();
                        } catch (error) {
                            console.error('Error deleting group:', error);
                            Alert.alert('Error', 'Failed to delete group.');
                        }
                    }
                }
            ]
        );
    };

    const renderFriendItem = ({ item }: { item: FriendModel }) => {
        const isSelected = selectedFriendIds.includes(item.id);
        return (
            <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b"
                style={{ borderColor: colors.border }}
                onPress={() => toggleFriend(item.id)}
            >
                <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
                    {item.name}
                </Text>
                {isSelected && <Check size={20} color={colors.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <AnimatedBottomSheet
            visible={visible}
            onClose={onClose}
            height="full"
            title={groupToEdit ? 'Edit Group' : 'New Group'}
            scrollable
            footerComponent={
                <View className="flex-row gap-3">
                    {groupToEdit && (
                        <TouchableOpacity
                            onPress={handleDelete}
                            className="p-4 rounded-xl items-center justify-center border"
                            style={{ borderColor: colors.destructive, width: 60 }}
                        >
                            <Trash2 size={20} color={colors.destructive} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-xl items-center justify-center"
                        style={{ backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }}
                    >
                        <Text className="font-inter-semibold text-base" style={{ color: colors.background }}>
                            {isSaving ? 'Saving...' : 'Save Group'}
                        </Text>
                    </TouchableOpacity>
                </View>
            }
        >
            <View className="flex-1">
                {/* Form */}
                <View className="p-5">
                    <Text className="font-inter-medium text-sm mb-2" style={{ color: colors['muted-foreground'] }}>
                        Group Name
                    </Text>
                    <TextInput
                        className="p-4 rounded-xl font-inter-regular text-base border"
                        style={{
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.foreground
                        }}
                        placeholder="e.g., Girl Group, Family"
                        placeholderTextColor={colors['muted-foreground']}
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View className="px-5 pb-2">
                    <Text className="font-inter-medium text-sm" style={{ color: colors['muted-foreground'] }}>
                        Select Members ({selectedFriendIds.length})
                    </Text>
                </View>

                {/* Friend List */}
                <View style={{ paddingBottom: 20 }}>
                    {allFriends.map(item => renderFriendItem({ item }))}
                </View>

            </View>
        </AnimatedBottomSheet>
    );
}
