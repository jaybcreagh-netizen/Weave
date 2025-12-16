import React, { useState, useEffect } from 'react';
import { View, Alert, FlatList, TouchableOpacity } from 'react-native';
import { Trash2, Check, Users } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useFriendActions } from '@/modules/relationships';
import { calculateCurrentScore } from '@/modules/intelligence';
import type FriendModel from '@/db/models/Friend';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

interface FriendManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FriendManagementModal({ visible, onClose }: FriendManagementModalProps) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState<FriendModel[]>([]);
  const { batchDeleteFriends } = useFriendActions();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const subscription = database
      .get<FriendModel>('friends')
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe(setFriends);

    return () => subscription.unsubscribe();
  }, []);

  // Reset selection when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
    }
  }, [visible]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (friends) {
      setSelectedIds(new Set(friends.map(f => f.id)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Delete Friends',
      `Are you sure you want to delete ${selectedIds.size} friend${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await batchDeleteFriends(Array.from(selectedIds));
              setSelectedIds(new Set());
              onClose();
            } catch (error) {
              console.error('Error deleting friends:', error);
              Alert.alert('Error', 'Failed to delete friends. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const sortedFriends = friends ? [...friends].sort((a, b) => a.name.localeCompare(b.name)) : [];

  const renderItem = ({ item: friend }: { item: FriendModel }) => {
    const isSelected = selectedIds.has(friend.id);
    const currentScore = calculateCurrentScore(friend);

    return (
      <TouchableOpacity
        onPress={() => toggleSelection(friend.id)}
        activeOpacity={0.7}
      >
        <Card
          className="flex-row items-center p-4 mb-2 border"
          style={{
            borderColor: isSelected ? `${colors.destructive}80` : 'transparent',
            backgroundColor: isSelected ? `${colors.destructive}0D` : colors.card, // 0D is ~5% opacity
          }}
        >
          {/* Checkbox */}
          <View
            className="w-6 h-6 rounded-md border items-center justify-center mr-3"
            style={{
              backgroundColor: isSelected ? colors.destructive : 'transparent',
              borderColor: isSelected ? colors.destructive : colors['muted-foreground']
            }}
          >
            {isSelected && <Check size={16} color={colors['destructive-foreground']} />}
          </View>

          {/* Friend Info */}
          <View className="flex-1">
            <Text variant="body" className="font-semibold" style={{ color: colors.foreground }}>
              {friend.name}
            </Text>
            <Text variant="caption" className="mt-0.5" style={{ color: colors['muted-foreground'] }}>
              {friend.dunbarTier} • Score: {Math.round(currentScore)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title="Manage Friends"
      snapPoints={['90%']}
      disableContentPanning
    >
      <View className="flex-1 px-4">
        {/* Selection Controls */}
        <View className="flex-row gap-3 mb-4">
          <Button
            onPress={selectAll}
            variant="secondary"
            className="flex-1"
            label="Select All"
          />
          <Button
            onPress={deselectAll}
            variant="secondary"
            className="flex-1"
            label="Deselect All"
          />
        </View>

        {/* Friend List */}
        <FlatList
          data={sortedFriends}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View className="items-center py-10">
              <Text variant="body" className="text-center" style={{ color: colors['muted-foreground'] }}>
                No friends to manage
              </Text>
            </View>
          }
        />

        {/* Footer */}
        <View className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: colors.border, backgroundColor: colors.background }}>
          <Button
            onPress={handleDelete}
            variant="destructive"
            disabled={selectedIds.size === 0 || isDeleting}
            className="w-full"
            label={isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Friend${selectedIds.size !== 1 ? 's' : ''}`}
          />
        </View>
      </View>
    </StandardBottomSheet>
  );
}
