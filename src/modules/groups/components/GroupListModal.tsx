import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert, FlatList } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Plus, Users, ChevronRight, Trash2, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
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

    const renderHeader = React.useCallback(() => (
        <View>
            <Button
                onPress={handleCreateGroup}
                variant="outline"
                className="mb-6 flex-row items-center justify-center gap-2 border-dashed border-2 py-4"
                style={{ borderColor: colors.border }}
            >
                <Plus size={20} color={colors.primary} />
                <Text variant="h4" className="font-semibold" style={{ color: colors.primary }}>
                    Create New Group
                </Text>
            </Button>

            {/* Suggestions Section */}
            {suggestions.length > 0 && (
                <View className="mb-6">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Sparkles size={16} color={colors.primary} />
                        <Text variant="h4" className="font-semibold" style={{ color: colors.primary }}>
                            Suggested Groups
                        </Text>
                    </View>

                    {suggestions.map((suggestion, index) => (
                        <Card
                            key={index}
                            className="mb-3 p-4 flex-row items-center justify-between"
                            style={{
                                backgroundColor: colors['card'], // Ensure card bg is correct
                                borderColor: `${colors.primary}33` // 20% opacity using hex
                            }}
                        >
                            <TouchableOpacity
                                className="flex-1 flex-row items-center justify-between"
                                onPress={() => handleCreateFromSuggestion(suggestion)}
                            >
                                <View className="flex-1 mr-4">
                                    <Text variant="body" className="font-semibold mb-1" style={{ color: colors.foreground }}>
                                        {suggestion.suggestedName}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                            {suggestion.interactionCount} weaves
                                        </Text>
                                        <View
                                            className="px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: `${colors.success}1A` }} // 10% opacity
                                        >
                                            <Text variant="caption" className="font-medium text-[10px]" style={{ color: colors.success }}>
                                                {(suggestion.confidence * 100).toFixed(0)}% Match
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View
                                    className="w-8 h-8 rounded-full items-center justify-center"
                                    style={{ backgroundColor: `${colors.primary}1A` }} // 10% opacity
                                >
                                    <Plus size={16} color={colors.primary} />
                                </View>
                            </TouchableOpacity>
                        </Card>
                    ))}
                </View>
            )}

            {groups.length > 0 && (
                <Text variant="h4" className="mb-3 font-medium" style={{ color: colors['muted-foreground'] }}>
                    Your Groups
                </Text>
            )}
        </View>
    ), [colors, groups.length, suggestions, handleCreateGroup, handleCreateFromSuggestion]);

    const renderItem = React.useCallback(({ item }: { item: Group }) => (
        <Card className="mb-3 p-0 overflow-hidden">
            <TouchableOpacity
                className="flex-row items-center justify-between p-4"
                onPress={() => handleEditGroup(item)}
            >
                <View className="flex-row items-center gap-3">
                    <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Users size={20} color={colors.foreground} />
                    </View>
                    <View>
                        <Text variant="body" className="font-semibold" style={{ color: colors.foreground }}>
                            {item.name}
                        </Text>
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                            Tap to edit
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                        onPress={() => handleDeleteGroup(item)}
                        className="p-2 -mr-2"
                        hitSlop={10}
                    >
                        <Trash2 size={20} color={colors.destructive} />
                    </TouchableOpacity>
                    <ChevronRight size={20} color={colors['muted-foreground']} />
                </View>
            </TouchableOpacity>
        </Card>
    ), [colors, handleEditGroup, handleDeleteGroup]);

    const renderEmpty = React.useCallback(() => (
        groups.length === 0 && suggestions.length === 0 ? (
            <View className="items-center py-12 px-10">
                <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: `${colors.muted}4D` }}>
                    <Users size={32} color={colors['muted-foreground']} />
                </View>
                <Text variant="h4" className="text-center mb-2" style={{ color: colors.foreground }}>No groups yet</Text>
                <Text variant="body" className="text-center" style={{ color: colors['muted-foreground'] }}>
                    Create groups to easily organize your friends.
                </Text>
            </View>
        ) : null
    ), [colors, groups.length, suggestions.length]);

    const renderContent = React.useCallback(() => (
        <BottomSheetFlatList
            data={groups}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            renderItem={renderItem}
        />
    ), [groups, renderHeader, renderEmpty, renderItem]);

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title="Manage Groups"
            snapPoints={['90%']}
            disableContentPanning={true}
            renderScrollContent={renderContent}
        >
            <></>
            <GroupManagerModal
                visible={isManagerVisible}
                onClose={() => setIsManagerVisible(false)}
                groupToEdit={editingGroup}
                initialData={initialData}
                onGroupSaved={loadGroups}
            />
        </StandardBottomSheet>
    );
}
