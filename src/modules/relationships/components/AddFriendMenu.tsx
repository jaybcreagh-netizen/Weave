import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { UserPlus, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text } from '@/shared/ui';

interface AddFriendMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSingle: () => void;
  onAddBatch: () => void;
}

export function AddFriendMenu({
  isOpen,
  onClose,
  onAddSingle,
  onAddBatch,
}: AddFriendMenuProps) {
  const { colors } = useTheme();

  const handleAddSingle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddSingle();
    onClose();
  };

  const handleAddBatch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddBatch();
    onClose();
  };

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      title="Add Friends"
      height="action"
    >
      <View className="p-6 gap-3">
        {/* Add Single Friend - Opens search-first sheet */}
        <TouchableOpacity
          className="flex-row items-center gap-3 py-3.5 px-4 rounded-xl"
          style={{ backgroundColor: colors.primary }}
          onPress={handleAddSingle}
          activeOpacity={0.8}
        >
          <UserPlus color={colors['primary-foreground']} size={20} />
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors['primary-foreground'] }}>
              Add Single Friend
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: colors['primary-foreground'], opacity: 0.8 }}>
              Search Weave or add manually
            </Text>
          </View>
        </TouchableOpacity>

        {/* Batch Add from Contacts */}
        <TouchableOpacity
          className="flex-row items-center gap-3 py-3.5 px-4 rounded-xl border"
          style={{
            backgroundColor: colors.muted,
            borderColor: colors.border,
          }}
          onPress={handleAddBatch}
          activeOpacity={0.8}
        >
          <Users color={colors.foreground} size={20} />
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
              Batch Add from Contacts
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: colors['muted-foreground'] }}>
              Quick import, refine later
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </StandardBottomSheet>
  );
}

