/**
 * QuickCaptureSheet
 * 
 * Mode 1: Minimal friction journal entry.
 * Just text + optional friend tag. No title, no date picker, no chips.
 * Saves as a draft/note that can be expanded later.
 * 
 * Design philosophy: Get the thought down NOW. Polish later.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { KeyboardScrollView } from '@/shared/ui';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { X, User, ChevronRight, Sparkles, Calendar } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';
import * as Haptics from 'expo-haptics';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

interface QuickCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  onExpandToFull: (text: string, friendIds: string[]) => void;
  prefilledFriendId?: string;  // Pre-select a friend
  prefilledText?: string;      // Pre-fill from weave notes
}

interface FriendChip {
  id: string;
  name: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuickCaptureSheet({
  visible,
  onClose,
  onExpandToFull,
  prefilledFriendId,
  prefilledText,
}: QuickCaptureSheetProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  // State
  const [text, setText] = useState(prefilledText || '');
  const [selectedFriends, setSelectedFriends] = useState<FriendChip[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<FriendModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load friends on mount
  useEffect(() => {
    loadFriends();
  }, []);

  // Handle prefilled friend
  useEffect(() => {
    if (prefilledFriendId && friends.length > 0) {
      const friend = friends.find(f => f.id === prefilledFriendId);
      if (friend && !selectedFriends.some(sf => sf.id === friend.id)) {
        setSelectedFriends([{ id: friend.id, name: friend.name }]);
      }
    }
  }, [prefilledFriendId, friends]);

  // Handle prefilled text
  useEffect(() => {
    if (prefilledText) {
      setText(prefilledText);
    }
  }, [prefilledText]);

  // Focus input when sheet opens
  useEffect(() => {
    if (visible) {
      // Small delay to allow sheet animation to start/finish
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
    }
  }, [visible]);

  const loadFriends = async () => {
    try {
      const allFriends = await database
        .get<FriendModel>('friends')
        .query(
          Q.where('is_dormant', false),
          Q.sortBy('name', Q.asc)
        )
        .fetch();
      setFriends(allFriends);
    } catch (error) {
      console.error('[QuickCapture] Error loading friends:', error);
    }
  };

  const toggleFriend = useCallback((friend: FriendModel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedFriends(prev => {
      const exists = prev.some(f => f.id === friend.id);
      if (exists) {
        return prev.filter(f => f.id !== friend.id);
      } else {
        return [...prev, { id: friend.id, name: friend.name }];
      }
    });
  }, []);

  const handleSave = async () => {
    if (!text.trim()) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await database.write(async () => {
        const newEntry = await database.get<JournalEntry>('journal_entries').create((entry) => {
          entry.content = text.trim();
          entry.entryDate = startOfDay(entryDate).getTime();
          entry.title = '';
          entry.isDraft = true;
        });

        // Link friends manually for M:N relation
        if (selectedFriends.length > 0) {
          for (const friendChip of selectedFriends) {
            await database.get<JournalEntryFriend>('journal_entry_friends').create(link => {
              link.journalEntry.set(newEntry);
              link.friendId = friendChip.id;
            });
          }
        }
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset and close
      setText('');
      setSelectedFriends([]);
      onClose();
    } catch (error) {
      console.error('[QuickCapture] Error saving:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleExpandToFull = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExpandToFull(text, selectedFriends.map(f => f.id));
    setText('');
    setSelectedFriends([]);
  };

  const handleClose = () => {
    // Check for unsaved changes
    if (text.trim()) {
      Alert.alert(
        'Discard note?',
        'You have unsaved changes that will be lost.',
        [
          { text: 'Keep Writing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Keyboard.dismiss();
              setText('');
              setSelectedFriends([]);
              onClose();
            },
          },
        ]
      );
    } else {
      Keyboard.dismiss();
      setText('');
      setSelectedFriends([]);
      onClose();
    }
  };

  const hasContent = text.trim().length > 0;

  // Footer component for StandardBottomSheet
  const renderFooter = (
    <View className="gap-4">
      <TouchableOpacity
        onPress={handleSave}
        disabled={!hasContent || saving}
        className="py-4 rounded-2xl items-center"
        style={{
          backgroundColor: hasContent ? colors.primary : colors.muted,
          opacity: saving ? 0.7 : 1,
        }}
        activeOpacity={0.8}
      >
        <Text
          className="text-base"
          style={{
            color: hasContent ? colors['primary-foreground'] : colors['muted-foreground'],
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          {saving ? 'Saving...' : 'Save note'}
        </Text>
      </TouchableOpacity>

      {/* Expand to full */}
      {hasContent && (
        <TouchableOpacity
          onPress={handleExpandToFull}
          className="flex-row items-center justify-center gap-2"
        >
          <Sparkles size={16} color={colors.primary} />
          <Text
            className="text-sm"
            style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
          >
            Expand into full reflection
          </Text>
          <ChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Content Container */}
        <View className="flex-1 justify-end">
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 10,
              paddingBottom: 24, // Initial padding
            }}
          >
            {/* Handle */}
            <View className="items-center pt-3 pb-2">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: colors.border }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3">
              <Text
                className="text-lg"
                style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
              >
                Quick Note
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                className="w-8 h-8 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.muted }}
              >
                <X size={18} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <View className="px-5 pb-3">
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDatePicker(true);
                }}
                className="flex-row items-center gap-2 px-3 py-2 rounded-full self-start"
                style={{
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Calendar size={14} color={colors['muted-foreground']} />
                <Text
                  className="text-sm"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                  {isToday(entryDate)
                    ? 'Today'
                    : isYesterday(entryDate)
                      ? 'Yesterday'
                      : format(entryDate, 'MMM d')}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={entryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setEntryDate(selectedDate);
                    }
                  }}
                />
              )}
            </View>

            {/* Content */}
            <View className="px-5">
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder="What happened?"
                placeholderTextColor={colors['muted-foreground']}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="text-base"
                style={{
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                  minHeight: 100,
                  maxHeight: 200,
                }}
              />

              {/* Friend Selector */}
              <View className="mt-4">
                <Text
                  className="text-xs mb-2"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Who was involved? (optional)
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {selectedFriends.map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      onPress={() => {
                        const fullFriend = friends.find(f => f.id === friend.id);
                        if (fullFriend) toggleFriend(fullFriend);
                      }}
                      className="flex-row items-center gap-1.5 px-3 py-2 rounded-full"
                      style={{
                        backgroundColor: colors.primary + '20',
                        borderWidth: 1,
                        borderColor: colors.primary,
                      }}
                    >
                      <User size={14} color={colors.primary} />
                      <Text
                        className="text-sm"
                        style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                      >
                        {friend.name}
                      </Text>
                      <X size={12} color={colors.primary} />
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    onPress={() => setShowFriendPicker(true)}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: colors.muted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <User size={14} color={colors['muted-foreground']} />
                    <Text
                      className="text-sm"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                    >
                      {selectedFriends.length > 0 ? 'Add' : 'Tag friend'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Footer Actions */}
            <View className="px-5 pt-6">
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasContent || saving}
                className="py-4 rounded-2xl items-center"
                style={{
                  backgroundColor: hasContent ? colors.primary : colors.muted,
                  opacity: saving ? 0.7 : 1,
                }}
                activeOpacity={0.8}
              >
                <Text
                  className="text-base"
                  style={{
                    color: hasContent ? colors['primary-foreground'] : colors['muted-foreground'],
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {saving ? 'Saving...' : 'Save note'}
                </Text>
              </TouchableOpacity>

              {hasContent && (
                <TouchableOpacity
                  onPress={handleExpandToFull}
                  className="flex-row items-center justify-center gap-2 mt-4"
                >
                  <Sparkles size={16} color={colors.primary} />
                  <Text
                    className="text-sm"
                    style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                  >
                    Expand into full reflection
                  </Text>
                  <ChevronRight size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Friend Picker Modal */}
      <FriendPickerModal
        visible={showFriendPicker}
        onClose={() => setShowFriendPicker(false)}
        friends={friends}
        selectedFriendIds={selectedFriends.map(f => f.id)}
        onToggleFriend={toggleFriend}
        colors={colors}
      />
    </Modal>
  );
}

// ============================================================================
// FRIEND PICKER MODAL
// ============================================================================

interface FriendPickerModalProps {
  visible: boolean;
  onClose: () => void;
  friends: FriendModel[];
  selectedFriendIds: string[];
  onToggleFriend: (friend: FriendModel) => void;
  colors: any;
}

function FriendPickerModal({
  visible,
  onClose,
  friends,
  selectedFriendIds,
  onToggleFriend,
  colors,
}: FriendPickerModalProps) {
  const [search, setSearch] = useState('');

  const filteredFriends = search
    ? friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : friends;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown.springify().damping(20)}
          className="rounded-t-3xl"
          style={{
            backgroundColor: colors.background,
            maxHeight: '70%',
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: colors.border }}>
            <Text
              className="text-lg"
              style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
            >
              Tag Friends
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                className="text-base"
                style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View className="px-5 py-3">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search friends..."
              placeholderTextColor={colors['muted-foreground']}
              className="px-4 py-3 rounded-xl text-base"
              style={{
                backgroundColor: colors.muted,
                color: colors.foreground,
                fontFamily: 'Inter_400Regular',
              }}
            />
          </View>

          {/* Friend List */}
          <KeyboardScrollView className="px-5 pb-8">
            {filteredFriends.map((friend) => {
              const isSelected = selectedFriendIds.includes(friend.id);

              return (
                <TouchableOpacity
                  key={friend.id}
                  onPress={() => onToggleFriend(friend)}
                  className="flex-row items-center justify-between py-3.5 border-b"
                  style={{ borderColor: colors.border }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.muted }}
                    >
                      <Text
                        className="text-base"
                        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                      >
                        {friend.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text
                        className="text-base"
                        style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                      >
                        {friend.name}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {friend.dunbarTier}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      borderWidth: isSelected ? 0 : 2,
                      borderColor: colors.border,
                    }}
                  >
                    {isSelected && (
                      <Text style={{ color: colors['primary-foreground'], fontSize: 14 }}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredFriends.length === 0 && (
              <View className="py-8 items-center">
                <Text
                  className="text-sm"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  No friends found
                </Text>
              </View>
            )}
          </KeyboardScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default QuickCaptureSheet;
