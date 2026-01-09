import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert, Image, ActionSheetIOS, Platform, Modal, SafeAreaView, FlatList } from 'react-native';
import { BufferedTextInput } from '@/shared/ui/BufferedTextInput';
import { Check, Trash2, Users, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import FriendModel from '@/db/models/Friend';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { groupService } from '../services/group.service';
import Group from '@/db/models/Group';
import { uploadGroupPhoto } from '@/modules/relationships/services/image.service';
import { resolveImageUri } from '@/modules/relationships/services/image.service';

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
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null); // New photo to upload


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
            // Load existing photo
            if (groupToEdit.photoUrl) {
                resolveImageUri(groupToEdit.photoUrl).then(resolved => {
                    setPhotoUri(resolved || null);
                });
            } else {
                setPhotoUri(null);
            }
            setPendingPhotoUri(null);
        } else if (initialData) {
            setName(initialData.name);
            setSelectedFriendIds(initialData.memberIds);
            setPhotoUri(null);
            setPendingPhotoUri(null);
        } else {
            setName('');
            setSelectedFriendIds([]);
            setPhotoUri(null);
            setPendingPhotoUri(null);
        }
    }, [groupToEdit, initialData, visible]);

    const toggleFriend = async (friendId: string) => {
        // 1. Optimistic Update
        const isSelected = selectedFriendIds.includes(friendId);

        if (isSelected) {
            setSelectedFriendIds(prev => prev.filter(id => id !== friendId));
        } else {
            setSelectedFriendIds(prev => [...prev, friendId]);
        }

        // 2. Auto-save if editing an existing group
        if (groupToEdit) {
            try {
                if (isSelected) {
                    await groupService.removeMember(groupToEdit.id, friendId);
                } else {
                    await groupService.addMember(groupToEdit.id, friendId);
                }

                // Refresh list in parent if needed (optional, but good for consistency)
                // onGroupSaved(); // Maybe too heavy to reload list on every tap? 
                // Let's decide: user just wants data saved. List refresh can happen on close.
            } catch (error) {
                console.error('Error auto-saving member:', error);
                // Revert on error
                if (isSelected) {
                    setSelectedFriendIds(prev => [...prev, friendId]);
                } else {
                    setSelectedFriendIds(prev => prev.filter(id => id !== friendId));
                }
                Alert.alert('Error', 'Failed to update group member.');
            }
        }
    };

    // ... (rest of code)



    const pickImage = async (useCamera: boolean) => {
        try {
            // Request permissions
            if (useCamera) {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Camera permission is required to take photos.');
                    return;
                }
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Photo library permission is required to select photos.');
                    return;
                }
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: 'images',
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: 'images',
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                });

            if (!result.canceled && result.assets[0]) {
                setPendingPhotoUri(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const showImagePicker = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        pickImage(true);
                    } else if (buttonIndex === 2) {
                        pickImage(false);
                    } else if (buttonIndex === 3) {
                        setPendingPhotoUri(null);
                        setPhotoUri(null);
                    }
                }
            );
        } else {
            Alert.alert(
                'Group Photo',
                'Choose an option',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Take Photo', onPress: () => pickImage(true) },
                    { text: 'Choose from Library', onPress: () => pickImage(false) },
                    {
                        text: 'Remove Photo', style: 'destructive', onPress: () => {
                            setPendingPhotoUri(null);
                            setPhotoUri(null);
                        }
                    },
                ]
            );
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
            let finalPhotoUrl: string | undefined = groupToEdit?.photoUrl || undefined;

            // Upload new photo if one was selected
            if (pendingPhotoUri) {
                const groupId = groupToEdit?.id || `temp_${Date.now()}`;
                const result = await uploadGroupPhoto(pendingPhotoUri, groupId);
                if (result.success) {
                    finalPhotoUrl = result.localUri;
                }
            } else if (!photoUri && groupToEdit?.photoUrl) {
                // Photo was removed
                finalPhotoUrl = undefined;
            }

            if (groupToEdit) {
                await groupService.updateGroup(groupToEdit.id, name, selectedFriendIds, finalPhotoUrl);
            } else {
                await groupService.createGroup(name, selectedFriendIds, finalPhotoUrl);
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

    const renderFriendItem = React.useCallback(({ item }: { item: FriendModel }) => {
        const isSelected = selectedFriendIds.includes(item.id);
        return (
            <TouchableOpacity
                onPress={() => toggleFriend(item.id)}
                activeOpacity={0.7}
            >
                <Card
                    className="flex-row items-center justify-between p-4 mb-2"
                    style={{
                        backgroundColor: isSelected ? `${colors.primary}0D` : colors.card, // 5% opacity
                        borderColor: isSelected ? colors.primary : 'transparent',
                        borderWidth: isSelected ? 1 : 0
                    }}
                >
                    <Text
                        variant="body"
                        className="font-medium"
                        style={{ color: isSelected ? colors.primary : colors.foreground }}
                    >
                        {item.name}
                    </Text>
                    {isSelected && <Check size={20} color={colors.primary} />}
                </Card>
            </TouchableOpacity>
        );
    }, [colors, selectedFriendIds, toggleFriend]);

    const displayPhoto = pendingPhotoUri || photoUri;

    const renderHeader = React.useCallback(() => (
        <View>
            {/* Photo Picker */}
            <View className="items-center mb-4">
                <TouchableOpacity
                    onPress={showImagePicker}
                    activeOpacity={0.7}
                    className="w-24 h-24 rounded-full items-center justify-center overflow-hidden"
                    style={{ backgroundColor: colors.muted }}
                >
                    {displayPhoto ? (
                        <Image
                            source={{ uri: displayPhoto }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="items-center justify-center">
                            <Users size={32} color={colors['muted-foreground']} />
                            <Camera size={16} color={colors['muted-foreground']} style={{ position: 'absolute', bottom: -2, right: -2 }} />
                        </View>
                    )}
                </TouchableOpacity>
                <Text variant="caption" className="mt-2" style={{ color: colors['muted-foreground'] }}>
                    Tap to add photo
                </Text>
            </View>

            {/* Form */}
            <View className="mb-6">
                <BufferedTextInput
                    label="Group Name"
                    placeholder="e.g., Girl Group, Family"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    inputClassName="p-4"
                    style={{
                        backgroundColor: colors.muted,
                    }}
                />
            </View>

            <View className="mb-2">
                <Text variant="h4" className="mb-2 font-medium" style={{ color: colors['muted-foreground'] }}>
                    Select Members ({selectedFriendIds.length})
                </Text>
            </View>
        </View>
    ), [displayPhoto, colors, selectedFriendIds.length, showImagePicker]);

    const renderFooter = React.useCallback(() => (
        <View className="flex-row gap-3">
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
                label={isSaving ? 'Saving...' : (groupToEdit ? 'Done' : 'Save Group')}
            />
        </View>
    ), [groupToEdit, isSaving, handleDelete, handleSave, colors]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="flex-row justify-between items-center p-5 border-b" style={{ borderColor: colors.border }}>
                    <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                        {groupToEdit ? 'Edit Group' : 'New Group'}
                    </Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <FlatList
                    data={allFriends}
                    keyExtractor={(item: FriendModel) => item.id}
                    renderItem={renderFriendItem}
                    ListHeaderComponent={renderHeader}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                    keyboardShouldPersistTaps="handled"
                />

                {/* Footer */}
                <View
                    className="absolute bottom-0 left-0 right-0 p-5 border-t"
                    style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        paddingBottom: 30
                    }}
                >
                    {renderFooter()}
                </View>
            </SafeAreaView>
        </Modal>
    );
}


