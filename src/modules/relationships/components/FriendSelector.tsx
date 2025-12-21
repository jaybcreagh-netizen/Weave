import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, TextInput, SafeAreaView, TextInput as RNTextInput } from 'react-native';

import { CheckCircle, Circle, Search, X, Users, Plus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import Group from '@/db/models/Group';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { groupService } from '@/modules/groups';
import { GroupManagerModal } from '@/modules/groups';

interface FriendSelectorProps {
    visible: boolean;
    onClose: () => void;
    initialFriendId?: string;
    selectedFriends: FriendModel[];
    onSelectionChange: (friends: FriendModel[]) => void;
    asModal?: boolean;
}

type Tab = 'friends' | 'groups';

export function FriendSelector({
    visible,
    onClose,
    initialFriendId,
    selectedFriends,
    onSelectionChange,
    asModal = false
}: FriendSelectorProps) {
    const { colors } = useTheme();
    const [allFriends, setAllFriends] = useState<FriendModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('friends');
    const [groups, setGroups] = useState<Group[]>([]);
    const [relevantGroups, setRelevantGroups] = useState<Group[]>([]);
    const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);
    const searchInputRef = useRef<RNTextInput>(null);

    useEffect(() => {
        const subscription = database
            .get<FriendModel>('friends')
            .query(Q.sortBy('created_at', Q.desc))
            .observe()
            .subscribe(setAllFriends);

        return () => subscription.unsubscribe();
    }, []);

    // Load groups
    const loadGroups = async () => {
        const manualGroups = await groupService.getManualGroups();
        setGroups(manualGroups);

        if (initialFriendId) {
            const friendGroups = await groupService.getGroupsForFriend(initialFriendId);
            setRelevantGroups(friendGroups);
        }
    };

    useEffect(() => {
        if (visible) {
            loadGroups();
        }
    }, [visible, initialFriendId]);

    // Filter friends based on search query - memoized to prevent unnecessary recalculations
    const filteredFriends = useMemo(() =>
        (allFriends || []).filter(friend =>
            friend.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        , [allFriends, searchQuery]);

    // Memoized handler to prevent re-renders
    const handleSearchChange = useCallback((text: string) => {
        setSearchQuery(text);
    }, []);

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

    const handleGroupSelect = async (group: Group) => {
        const members = await group.members.fetch();
        const memberIds = members.map((m: any) => m.friendId);

        // Find friend objects for these IDs
        const friendsToSelect = allFriends.filter(f => memberIds.includes(f.id));

        // Merge with existing selection, avoiding duplicates
        const newSelection = [...selectedFriends];
        friendsToSelect.forEach(friend => {
            if (!newSelection.some(f => f.id === friend.id)) {
                newSelection.push(friend);
            }
        });

        onSelectionChange(newSelection);
        // Optional: Switch back to friends tab to show selection
        setActiveTab('friends');
    };

    const handleEditGroup = (group: Group) => {
        setEditingGroup(group);
        setIsGroupModalVisible(true);
    };

    const renderRelevantGroupChip = (group: Group) => (
        <TouchableOpacity
            key={group.id}
            className="flex-row items-center px-3 py-2 rounded-full mr-2 mb-2"
            style={{ backgroundColor: colors.secondary }}
            onPress={() => handleGroupSelect(group)}
        >
            <Users size={14} color={colors.foreground} style={{ marginRight: 6 }} />
            <Text className="font-inter-medium text-sm" style={{ color: colors.foreground }}>
                {group.name}
            </Text>
            <Plus size={14} color={colors.primary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
    );

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

    const renderGroupItem = ({ item }: { item: Group }) => {
        return (
            <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b"
                style={{ borderColor: colors.border }}
                onPress={() => handleGroupSelect(item)}
                onLongPress={() => handleEditGroup(item)}
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
                            Tap to select all members • Long press to edit
                        </Text>
                    </View>
                </View>
                <Plus size={20} color={colors.primary} />
            </TouchableOpacity>
        );
    };

    // --- RENDER HELPERS ---

    const renderHeader = () => (
        <View className="bg-background">
            {/* Header - Only for Modal (Sheet has its own title) */}
            {asModal && (
                <View className="flex-row justify-between items-center p-5 border-b" style={{ borderColor: colors.border }}>
                    <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                        Add Friends
                    </Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Tabs */}
            <View className="flex-row p-2 mx-5 mt-3 rounded-xl" style={{ backgroundColor: colors.muted }}>
                <TouchableOpacity
                    className="flex-1 py-2 rounded-lg items-center"
                    style={{
                        backgroundColor: activeTab === 'friends' ? colors.card : undefined,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: activeTab === 'friends' ? 0.05 : 0,
                        shadowRadius: 2,
                        elevation: activeTab === 'friends' ? 1 : 0
                    }}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text className={`font-inter-medium ${activeTab === 'friends' ? 'text-primary' : 'text-muted-foreground'}`}
                        style={{ color: activeTab === 'friends' ? colors.primary : colors['muted-foreground'] }}>
                        Friends
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 py-2 rounded-lg items-center"
                    style={{
                        backgroundColor: activeTab === 'groups' ? colors.card : undefined,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: activeTab === 'groups' ? 0.05 : 0,
                        shadowRadius: 2,
                        elevation: activeTab === 'groups' ? 1 : 0
                    }}
                    onPress={() => setActiveTab('groups')}
                >
                    <Text className={`font-inter-medium ${activeTab === 'groups' ? 'text-primary' : 'text-muted-foreground'}`}
                        style={{ color: activeTab === 'groups' ? colors.primary : colors['muted-foreground'] }}>
                        Groups
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Friends Tab Header Content */}
            {activeTab === 'friends' && (
                <>
                    <View className="px-5 py-3">
                        <View
                            className="flex-row items-center px-4 py-3 rounded-xl"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Search size={18} color={colors['muted-foreground']} />
                            <TextInput
                                ref={searchInputRef}
                                className="flex-1 ml-3 font-inter-regular text-base"
                                style={{ color: colors.foreground }}
                                placeholder="Search friends..."
                                placeholderTextColor={colors['muted-foreground']}
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X size={16} color={colors['muted-foreground']} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {relevantGroups.length > 0 && (
                        <View className="px-5 pb-2">
                            <Text className="font-inter-medium text-xs mb-2" style={{ color: colors['muted-foreground'] }}>
                                Quick Add Groups
                            </Text>
                            <View className="flex-row flex-wrap">
                                {relevantGroups.map(renderRelevantGroupChip)}
                            </View>
                        </View>
                    )}
                </>
            )}

            {/* Groups Tab Header Content */}
            {activeTab === 'groups' && (
                <TouchableOpacity
                    className="flex-row items-center p-4 border-b border-t"
                    style={{ borderColor: colors.border }}
                    onPress={() => {
                        setEditingGroup(undefined);
                        setIsGroupModalVisible(true);
                    }}
                >
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                        <Plus size={20} color={colors.background} />
                    </View>
                    <Text className="font-inter-medium text-base" style={{ color: colors.primary }}>
                        Create New Group
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderFooter = () => (
        <TouchableOpacity
            onPress={onClose}
            className="py-4 rounded-xl items-center"
            style={{ backgroundColor: colors.primary }}
        >
            <Text className="font-inter-semibold text-base" style={{ color: colors.background }}>
                Done ({selectedFriends.length})
            </Text>
        </TouchableOpacity>
    );

    const renderEmpty = () => (
        <View className="items-center py-12 px-10">
            {activeTab === 'friends' ? (
                <Text style={{ color: colors['muted-foreground'] }}>No friends found</Text>
            ) : (
                <>
                    <Text className="text-center mb-2" style={{ color: colors.foreground }}>No groups yet</Text>
                    <Text className="text-center text-sm" style={{ color: colors['muted-foreground'] }}>
                        Create a group to easily select multiple friends at once (e.g., "Family", "Girl Group").
                    </Text>
                </>
            )}
        </View>
    );

    // --- MODAL RENDER ---
    if (asModal) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                    <View className="flex-1">
                        <FlatList
                            data={activeTab === 'friends' ? filteredFriends : groups}
                            renderItem={activeTab === 'friends' ? renderFriendItem : renderGroupItem as any}
                            keyExtractor={(item: any) => item.id}
                            ListHeaderComponent={renderHeader}
                            ListEmptyComponent={renderEmpty}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="none"
                        />
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
                        {isGroupModalVisible && (
                            <GroupManagerModal
                                visible={isGroupModalVisible}
                                onClose={() => setIsGroupModalVisible(false)}
                                groupToEdit={editingGroup}
                                onGroupSaved={loadGroups}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    // --- SHEET RENDER ---
    const renderSheetContent = () => (
        <BottomSheetFlatList
            data={activeTab === 'friends' ? filteredFriends : groups}
            renderItem={activeTab === 'friends' ? renderFriendItem : renderGroupItem as any}
            keyExtractor={(item: any) => item.id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
        />
    );

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            height="full"
            title="Add Friends"
            renderScrollContent={renderSheetContent}
            footerComponent={renderFooter()}
            disableContentPanning
        >
            {/* Children required by type but not used when renderScrollContent is present */}
            <></>
            {isGroupModalVisible && (
                <GroupManagerModal
                    visible={isGroupModalVisible}
                    onClose={() => setIsGroupModalVisible(false)}
                    groupToEdit={editingGroup}
                    onGroupSaved={loadGroups}
                />
            )}
        </StandardBottomSheet>
    );
}
