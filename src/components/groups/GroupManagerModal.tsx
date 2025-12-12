import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert, FlatList } from 'react-native';
import { Check, Trash2, Users } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';
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
                onPress={() => toggleFriend(item.id)}
                activeOpacity={0.7}
            >
                <Card
                    className={`flex-row items-center justify-between p-4 mb-2 border ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                >
                    <Text variant="body" className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {item.name}
                    </Text>
                    {isSelected && <Check size={20} color={colors.primary} />}
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title={groupToEdit ? 'Edit Group' : 'New Group'}
            snapPoints={['90%']}
            scrollable={false} // Using FlatList for custom scrolling
        >
            <View className="flex-1 px-4">
                {/* Form */}
                <View className="mb-6">
                    <Input
                        label="Group Name"
                        placeholder="e.g., Girl Group, Family"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                    />
                </View>

                <View className="flex-1 mb-2">
                    <Text variant="h4" className="mb-2 text-muted-foreground font-medium">
                        Select Members ({selectedFriendIds.length})
                    </Text>

                    <FlatList
                        data={allFriends}
                        keyExtractor={item => item.id}
                        renderItem={renderFriendItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        nestedScrollEnabled={true}
                    />
                </View>

                {/* Footer Actions */}
                <View className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background flex-row gap-3">
                    {groupToEdit && (
                        <Button
                            onPress={handleDelete}
                            variant="destructive"
                            className="px-4"
                        >
                            <Trash2 size={20} color={colors['destructive-foreground']} />
                        </Button>
                    )}

                    <Button
                        onPress={handleSave}
                        variant="primary"
                        disabled={isSaving}
                        className="flex-1"
                    >
                        {isSaving ? 'Saving...' : 'Save Group'}
                    </Button>
                </View>
            </View>
        </StandardBottomSheet>
    );
}
