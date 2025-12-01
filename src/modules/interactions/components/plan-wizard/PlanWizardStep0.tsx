import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { CheckCircle, Circle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { useFriends } from '@/modules/relationships';

interface PlanWizardStep0Props {
  initialFriend: FriendModel;
  selectedFriends: FriendModel[];
  onFriendsSelect: (friends: FriendModel[]) => void;
  onContinue: () => void;
  canContinue: boolean;
}

export function PlanWizardStep0({ initialFriend, selectedFriends, onFriendsSelect, onContinue, canContinue }: PlanWizardStep0Props) {
  const { colors } = useTheme();
  const allFriends = useFriends();

  // Initialize selected friends with the initial friend if not already present
  useEffect(() => {
    if (!selectedFriends.some(f => f.id === initialFriend.id)) {
      onFriendsSelect([initialFriend]);
    }
  }, [initialFriend, selectedFriends, onFriendsSelect]);

  const toggleFriendSelection = (friend: FriendModel) => {
    const isSelected = selectedFriends.some(f => f.id === friend.id);
    if (isSelected) {
      // Prevent deselecting the initial friend if it's the only one selected
      if (selectedFriends.length === 1 && selectedFriends[0].id === friend.id) {
        return; // Cannot deselect the last friend
      }
      onFriendsSelect(selectedFriends.filter(f => f.id !== friend.id));
    } else {
      onFriendsSelect([...selectedFriends, friend]);
    }
  };

  const renderFriendItem = ({ item }: { item: FriendModel }) => {
    const isSelected = selectedFriends.some(f => f.id === item.id);
    return (
      <TouchableOpacity
        className="flex-row items-center justify-between p-4 border-b"
        style={{ borderColor: colors.border }}
        onPress={() => toggleFriendSelection(item)}
      >
        <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
          {item.name}
        </Text>
        {isSelected ? (
          <CheckCircle size={20} color={colors.primary} />
        ) : (
          <Circle size={20} color={colors['muted-foreground']} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 p-5">
      <Text className="font-lora-bold text-2xl mb-4" style={{ color: colors.foreground }}>
        Who are you planning with?
      </Text>
      <Text className="font-inter-regular text-base mb-6" style={{ color: colors['muted-foreground'] }}>
        Select all friends involved in this plan. You must select at least one.
      </Text>

      <FlatList
        data={(allFriends || []).filter(f => f.id !== initialFriend.id)} // Exclude initial friend from the main list, it's pre-selected
        renderItem={renderFriendItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => (
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 border-b"
            style={{ borderColor: colors.border }}
            onPress={() => toggleFriendSelection(initialFriend)}
          >
            <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
              {initialFriend.name} (You started with this friend)
            </Text>
            <CheckCircle size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        onPress={onContinue}
        disabled={!canContinue}
        className="py-3 px-5 rounded-full mt-6"
        style={{
          backgroundColor: canContinue ? colors.primary : colors.muted,
          opacity: canContinue ? 1 : 0.5,
        }}
      >
        <Text className="font-inter-semibold text-lg text-center" style={{ color: colors.background }}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}
