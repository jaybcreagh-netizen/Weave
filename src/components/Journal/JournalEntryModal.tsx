/**
 * JournalEntryModal
 * Create or edit ad-hoc journal entries
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { X, Calendar, Users, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '../../db';
import JournalEntry from '../../db/models/JournalEntry';
import FriendModel from '../../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { STORY_CHIPS } from '../../lib/story-chips';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { YourPatternsSection } from '../YourPatternsSection';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: JournalEntry | null; // If provided, edit mode
  onSave: () => void;
}

export function JournalEntryModal({ isOpen, onClose, entry, onSave }: JournalEntryModalProps) {
  const { colors } = useTheme();
  const isEditMode = !!entry;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(new Date());
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [allFriends, setAllFriends] = useState<FriendModel[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showChipSelector, setShowChipSelector] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      if (entry) {
        // Load existing entry data
        setTitle(entry.title || '');
        setContent(entry.content);
        setEntryDate(new Date(entry.entryDate));
        setSelectedFriendIds(new Set(entry.friendIds));
        setSelectedChips(new Set(entry.storyChips.map(chip => chip.chipId)));
      } else {
        // Reset for new entry
        setTitle('');
        setContent('');
        setEntryDate(new Date());
        setSelectedFriendIds(new Set());
        setSelectedChips(new Set());
      }
    }
  }, [isOpen, entry]);

  const loadFriends = async () => {
    try {
      const friends = await database
        .get<FriendModel>('friends')
        .query(Q.where('is_dormant', false), Q.sortBy('name', Q.asc))
        .fetch();
      setAllFriends(friends);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      return; // Content is required
    }

    try {
      await database.write(async () => {
        if (entry) {
          // Update existing entry
          await entry.update(journalEntry => {
            journalEntry.title = title.trim() || undefined;
            journalEntry.content = content.trim();
            journalEntry.entryDate = entryDate.getTime();
            journalEntry.friendIds = Array.from(selectedFriendIds);
            journalEntry.storyChips = Array.from(selectedChips).map(chipId => ({ chipId }));
            journalEntry.updatedAt = new Date();
          });
        } else {
          // Create new entry
          await database.get<JournalEntry>('journal_entries').create(journalEntry => {
            journalEntry.title = title.trim() || undefined;
            journalEntry.content = content.trim();
            journalEntry.entryDate = entryDate.getTime();
            journalEntry.friendIds = Array.from(selectedFriendIds);
            journalEntry.storyChips = Array.from(selectedChips).map(chipId => ({ chipId }));
          });
        }
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving journal entry:', error);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const toggleFriend = (friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSet = new Set(selectedFriendIds);
    if (newSet.has(friendId)) {
      newSet.delete(friendId);
    } else {
      newSet.add(friendId);
    }
    setSelectedFriendIds(newSet);
  };

  const toggleChip = (chipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSet = new Set(selectedChips);
    if (newSet.has(chipId)) {
      newSet.delete(chipId);
    } else {
      newSet.add(chipId);
    }
    setSelectedChips(newSet);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="px-5 py-4 flex-row items-center justify-between"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <Text
            className="text-xl font-bold"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            {isEditMode ? 'Edit Entry' : 'New Journal Entry'}
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleSave}
              disabled={!content.trim()}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: content.trim() ? colors.primary : colors.muted,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: content.trim() ? colors['primary-foreground'] : colors['muted-foreground'],
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                Save
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} className="p-2">
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
          {/* Date Selector */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              Entry Date
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDatePicker(true);
              }}
              className="flex-row items-center px-4 py-3 rounded-xl"
              style={{ backgroundColor: colors.muted }}
            >
              <Calendar size={18} color={colors.foreground} />
              <Text
                className="text-base ml-3"
                style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
              >
                {entryDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={entryDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setEntryDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* Title (optional) */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              Title (optional)
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Give this entry a title..."
              placeholderTextColor={colors['muted-foreground']}
              className="px-4 py-3 rounded-xl text-base"
              style={{
                backgroundColor: colors.muted,
                color: colors.foreground,
                fontFamily: 'Inter_400Regular',
              }}
            />
          </View>

          {/* Content */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              What's on your mind?
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write your thoughts..."
              placeholderTextColor={colors['muted-foreground']}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              className="px-4 py-3 rounded-xl text-base"
              style={{
                backgroundColor: colors.muted,
                color: colors.foreground,
                fontFamily: 'Inter_400Regular',
                minHeight: 150,
              }}
            />
          </View>

          {/* Friend Tags */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              Tag Friends
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-2 mb-2"
            >
              {allFriends.map(friend => {
                const isSelected = selectedFriendIds.has(friend.id);
                return (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => toggleFriend(friend.id)}
                    className="px-4 py-2 rounded-full"
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.muted,
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: isSelected ? colors['primary-foreground'] : colors.foreground,
                        fontFamily: 'Inter_500Medium',
                      }}
                    >
                      {friend.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {selectedFriendIds.size === 0 && (
              <Text
                className="text-xs"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                No friends tagged
              </Text>
            )}
          </View>

          {/* Your Patterns */}
          {!isEditMode && (
            <View className="mb-6">
              <YourPatternsSection
                onCustomChipCreated={() => {
                  // Reload patterns when a custom chip is created
                  console.log('Custom chip created');
                }}
              />
            </View>
          )}

          {/* Story Chips (Optional) */}
          <View className="mb-4">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowChipSelector(!showChipSelector);
              }}
              className="flex-row items-center justify-between mb-2"
            >
              <Text
                className="text-sm font-medium"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                Story Chips (optional)
              </Text>
              <Sparkles size={16} color={colors['muted-foreground']} />
            </TouchableOpacity>

            {showChipSelector && (
              <View className="flex-row flex-wrap gap-2 mb-2">
                {STORY_CHIPS.map(chip => {
                  const isSelected = selectedChips.has(chip.id);
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      onPress={() => toggleChip(chip.id)}
                      className="px-3 py-2 rounded-full"
                      style={{
                        backgroundColor: isSelected ? colors.primary + '20' : colors.muted,
                      }}
                    >
                      <Text
                        className="text-xs"
                        style={{
                          color: isSelected ? colors.primary : colors.foreground,
                          fontFamily: 'Inter_400Regular',
                        }}
                      >
                        {chip.plainText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedChips.size > 0 && !showChipSelector && (
              <View className="flex-row flex-wrap gap-2">
                {Array.from(selectedChips).map(chipId => {
                  const chip = STORY_CHIPS.find(c => c.id === chipId);
                  if (!chip) return null;
                  return (
                    <View
                      key={chipId}
                      className="px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <Text
                        className="text-xs"
                        style={{ color: colors.primary, fontFamily: 'Inter_400Regular' }}
                      >
                        {chip.plainText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
