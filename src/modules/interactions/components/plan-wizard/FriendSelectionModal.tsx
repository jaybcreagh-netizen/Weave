import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, SafeAreaView } from 'react-native';
import { CheckCircle, Circle, X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/modules/interactions/db/models/Friend';
import { useFriends } from '@/modules/interactions/hooks/useFriends';

interface FriendSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  initialFriend: FriendModel;
  selectedFriends: FriendModel[];
  onSelect: (friends: FriendModel[]) => void;
}

export function FriendSelectionModal({ visible, onClose, initialFriend, selectedFriends, onSelect }: FriendSelectionModalProps) {
  const { colors } = useTheme();
  const allFriends = useFriends(); // Corrected usage
  const [localSelectedFriends, setLocalSelectedFriends] = useState(selectedFriends);

  useEffect(() => {
    setLocalSelectedFriends(selectedFriends);
  }, [selectedFriends]);

  const toggleFriendSelection = (friend: FriendModel) => {
    const isSelected = localSelectedFriends.some(f => f.id === friend.id);
    if (isSelected) {
      if (localSelectedFriends.length === 1 && localSelectedFriends[0].id === friend.id) {
        return; // Cannot deselect the last friend
      }
      setLocalSelectedFriends(localSelectedFriends.filter(f => f.id !== friend.id));
    } else {
      setLocalSelectedFriends([...localSelectedFriends, friend]);
    }
  };

  const handleSave = () => {
    onSelect(localSelectedFriends);
    onClose();
  };

  const renderFriendItem = (friend: FriendModel) => {
    const isSelected = localSelectedFriends.some(f => f.id === friend.id);
    return (
      <TouchableOpacity
        key={friend.id}
        className="flex-row items-center justify-between p-4 border-b"
        style={{ borderColor: colors.border }}
        onPress={() => toggleFriendSelection(friend)}
      >
        <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
          {friend.name}
        </Text>
        {isSelected ? (
          <CheckCircle size={20} color={colors.primary} />
        ) : (
          <Circle size={20} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: colors.border }}>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="font-lora-bold text-lg" style={{ color: colors.foreground }}>
            Add Friends
          </Text>
          <TouchableOpacity onPress={handleSave} className="p-2">
            <Text className="font-inter-semibold text-base" style={{ color: colors.primary }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-5">
          <Text className="font-inter-regular text-base mb-6" style={{ color: colors.mutedForeground }}>
            Select all friends involved in this plan.
          </Text>
          {renderFriendItem(initialFriend)} 
          {(allFriends || []).filter(f => f.id !== initialFriend.id).map(renderFriendItem)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
