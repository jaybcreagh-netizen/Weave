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
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { KeyboardScrollView } from '@/shared/ui';
import { BufferedTextInput } from '@/shared/ui/BufferedTextInput';
import { FriendSelector } from '@/modules/relationships';

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

// Using FriendModel[] directly instead of FriendChip

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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // State
  const [text, setText] = useState(prefilledText || '');
  const [selectedFriends, setSelectedFriends] = useState<FriendModel[]>([]);
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
        setSelectedFriends([friend]);
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
      // Small delay to allow sheet animation to complete
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
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

  // Handler for FriendSelector selection changes
  const handleFriendSelectionChange = useCallback((friends: FriendModel[]) => {
    setSelectedFriends(friends);
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
          for (const friend of selectedFriends) {
            await database.get<JournalEntryFriend>('journal_entry_friends').create(link => {
              link.journalEntry.set(newEntry);
              link.friendId = friend.id;
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

  // Remove a friend from selection (for chip X button)
  const removeFriend = useCallback((friendId: string) => {
    setSelectedFriends(prev => prev.filter(f => f.id !== friendId));
  }, []);

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
              // Small delay to allow keyboard to dismiss before unmounting
              setTimeout(() => {
                setText('');
                setSelectedFriends([]);
                onClose();
              }, 100);
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

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{
              paddingTop: insets.top > 0 ? insets.top : 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={handleClose} className="p-2 -ml-2">
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>

            <Text
              className="text-lg"
              style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
            >
              Quick Note
            </Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasContent || saving}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: hasContent ? colors.primary : colors.muted,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: hasContent ? colors['primary-foreground'] : colors['muted-foreground'],
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              className="flex-1 px-5 py-4"
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Date Selector */}
              <View className="mb-4">
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

              {/* Prompt Label - Outside the box */}
              <Text
                className="text-sm font-medium mb-3 px-1"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                What happened?
              </Text>

              {/* Text Input - The "Grey Box" */}
              <View
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: colors.muted }}
              >
                <BufferedTextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Write your thoughts..."
                  placeholderTextColor={colors['muted-foreground'] + '80'}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  // Remove internal padding/styling since container handles it
                  containerClassName="w-full"
                  inputClassName="p-0 text-base leading-6"
                  style={{
                    backgroundColor: 'transparent', // Input itself is transparent
                    color: colors.foreground,
                    fontFamily: 'Inter_400Regular',
                    minHeight: 120, // height controlled here
                    borderWidth: 0, // no border on internal input
                  }}
                />
              </View>

              {/* Friend Selector - Distinct separate pill */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                {selectedFriends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => removeFriend(friend.id)}
                    className="flex-row items-center gap-2 px-4 py-2.5 rounded-full"
                    style={{
                      backgroundColor: colors.primary + '15',
                      borderWidth: 1,
                      borderColor: colors.primary,
                    }}
                  >
                    <User size={15} color={colors.primary} />
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                    >
                      {friend.name}
                    </Text>
                    <X size={12} color={colors.primary} />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowFriendPicker(true);
                  }}
                  className="flex-row items-center gap-2 px-4 py-2.5 rounded-full"
                  style={{
                    backgroundColor: colors.muted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <User size={15} color={colors['muted-foreground']} />
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                  >
                    {selectedFriends.length > 0 ? 'Add friend' : 'Tag friend'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Expand to full */}
              {hasContent && (
                <TouchableOpacity
                  onPress={handleExpandToFull}
                  className="flex-row items-center justify-center gap-2 py-3"
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
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Friend Selector - Using standard component */}
      <FriendSelector
        visible={showFriendPicker}
        onClose={() => setShowFriendPicker(false)}
        selectedFriends={selectedFriends}
        onSelectionChange={handleFriendSelectionChange}
        asModal={true}
      />
    </>
  );
}

export default QuickCaptureSheet;
