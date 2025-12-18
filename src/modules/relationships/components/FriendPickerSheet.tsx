import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, TextInput, Image } from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { normalizeContactImageUri } from '../utils/image.utils';
import { resolveImageUri } from '../services/image.service';

interface FriendPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectFriend: (friend: FriendModel) => void;
  title?: string;
  subtitle?: string;
}

export function FriendPickerSheet({
  visible,
  onClose,
  onSelectFriend,
  title = 'Choose a Friend',
  subtitle,
}: FriendPickerSheetProps) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState<FriendModel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      return;
    }

    const subscription = database
      .get<FriendModel>('friends')
      .query(Q.sortBy('name', Q.asc))
      .observe()
      .subscribe(setFriends);

    return () => subscription.unsubscribe();
  }, [visible]);

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFriend = useCallback(
    (friend: FriendModel) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectFriend(friend);
      onClose();
    },
    [onSelectFriend, onClose]
  );

  const renderFriendItem = useCallback(
    ({ item }: { item: FriendModel }) => {
      const photoUrl = item.photoUrl ? resolveImageUri(item.photoUrl) : null;

      return (
        <TouchableOpacity
          className="flex-row items-center px-5 py-3"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={() => handleSelectFriend(item)}
          activeOpacity={0.7}
        >
          <View
            className="w-11 h-11 rounded-full overflow-hidden items-center justify-center"
            style={{
              backgroundColor: colors.muted,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            {photoUrl ? (
              <Image
                source={{ uri: normalizeContactImageUri(photoUrl) }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text
                className="text-lg font-semibold"
                style={{ color: colors.foreground }}
              >
                {item.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1 ml-3">
            <Text
              className="text-base font-semibold"
              style={{ color: colors.foreground }}
            >
              {item.name}
            </Text>
            {item.archetype && item.archetype !== 'Unknown' && (
              <Text
                className="text-sm mt-0.5"
                style={{ color: colors['muted-foreground'] }}
              >
                {item.archetype}
              </Text>
            )}
          </View>
          <ChevronRight size={20} color={colors['muted-foreground']} />
        </TouchableOpacity>
      );
    },
    [colors, handleSelectFriend]
  );

  const ListHeader = (
    <View className="px-5 py-3">
      {subtitle && (
        <Text
          className="text-sm mb-3 text-center"
          style={{ color: colors['muted-foreground'] }}
        >
          {subtitle}
        </Text>
      )}
      <View
        className="flex-row items-center px-4 py-3 rounded-xl"
        style={{ backgroundColor: colors.muted }}
      >
        <Search size={18} color={colors['muted-foreground']} />
        <TextInput
          className="flex-1 ml-3 text-base"
          style={{ color: colors.foreground }}
          placeholder="Search friends..."
          placeholderTextColor={colors['muted-foreground']}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const ListEmpty = (
    <View className="items-center py-12 px-8">
      <Text
        className="text-center text-base"
        style={{ color: colors['muted-foreground'] }}
      >
        {searchQuery
          ? `No friends matching "${searchQuery}"`
          : 'No friends added yet'}
      </Text>
    </View>
  );

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      height="large"
      title={title}
      disableContentPanning
    >
      <BottomSheetFlatList
        data={filteredFriends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      />
    </StandardBottomSheet>
  );
}
