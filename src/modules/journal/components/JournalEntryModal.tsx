/**
 * JournalEntryModal
 * Create or edit ad-hoc journal entries
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Calendar, Sparkles, Trash2, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { BottomSheetInput } from '@/shared/ui';

import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import FriendModel from '@/db/models/Friend';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { STORY_CHIPS } from '@/modules/reflection';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { logger } from '@/shared/services/logger.service';
import { YourPatternsSection } from '@/modules/insights';
import { useRouter } from 'expo-router';
import { actionExtractionService } from '@/modules/oracle';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: JournalEntry | null; // If provided, edit mode
  onSave: () => void;
  onDelete?: () => void; // Called after successful deletion
}

export function JournalEntryModal({ isOpen, onClose, entry, onSave, onDelete }: JournalEntryModalProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const isEditMode = !!entry;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(new Date());
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [allFriends, setAllFriends] = useState<FriendModel[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showChipSelector, setShowChipSelector] = useState(false);

  // Track which entry we've initialized to prevent resetting state on re-renders
  const [initializedForId, setInitializedForId] = useState<string | null>(null);

  // Linked weave info for "View original weave" button
  const [linkedWeaveInfo, setLinkedWeaveInfo] = useState<{
    friendId: string;
    friendName: string;
    activityLabel: string;
  } | null>(null);



  useEffect(() => {
    // Determine the key for tracking initialization (entry.id for edit mode, 'new' for new entry)
    const entryKey = entry?.id ?? 'new';

    // Only initialize when modal opens with a new/different entry
    if (isOpen && initializedForId !== entryKey) {
      setInitializedForId(entryKey);
      loadFriends();

      if (entry) {
        // Load existing entry data
        setTitle(entry.title || '');
        setContent(entry.content);
        setEntryDate(new Date(entry.entryDate));
        setSelectedChips(new Set(entry.storyChips.map(chip => chip.chipId)));

        // Load linked friends
        database.get<JournalEntryFriend>('journal_entry_friends')
          .query(Q.where('journal_entry_id', entry.id))
          .fetch()
          .then(links => {
            setSelectedFriendIds(new Set(links.map(link => link.friendId)));
          })
          .catch(err => logger.error('JournalEntry', 'Error fetching linked friends:', err));

        // Load linked weave info if present
        if (entry.linkedWeaveId) {
          loadLinkedWeaveInfo(entry.linkedWeaveId);
        } else {
          setLinkedWeaveInfo(null);
        }
      } else {
        // Reset for new entry
        setTitle('');
        setContent('');
        setEntryDate(new Date());
        setSelectedFriendIds(new Set());
        setSelectedChips(new Set());
        setLinkedWeaveInfo(null);
      }
    }

    // Reset initialization tracking when modal closes
    if (!isOpen) {
      setInitializedForId(null);
    }
  }, [isOpen, entry, initializedForId]);

  const loadLinkedWeaveInfo = async (weaveId: string) => {
    try {
      const interaction = await database.get<Interaction>('interactions').find(weaveId);
      const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', weaveId))
        .fetch();

      if (interactionFriends.length > 0) {
        const friend = await database.get<FriendModel>('friends').find(interactionFriends[0].friendId);
        setLinkedWeaveInfo({
          friendId: friend.id,
          friendName: friend.name,
          activityLabel: interaction.title || interaction.activity || 'weave',
        });
      }
    } catch (err) {
      logger.warn('JournalEntry', 'Could not load linked weave info', { err });
      setLinkedWeaveInfo(null);
    }
  };

  const handleViewOriginalWeave = () => {
    if (!linkedWeaveInfo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    // Navigate to friend profile - the weave will be visible in the timeline
    router.push(`/friend-profile?friendId=${linkedWeaveInfo.friendId}`);
  };

  const loadFriends = async () => {
    try {
      const friends = await database
        .get<FriendModel>('friends')
        .query(Q.where('is_dormant', false), Q.sortBy('name', Q.asc))
        .fetch();
      setAllFriends(friends);
    } catch (error) {
      logger.error('JournalEntry', 'Error loading friends:', error);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      return; // Content is required
    }

    try {
      let targetId: string | undefined;

      await database.write(async () => {
        let journalEntry = entry;

        if (journalEntry) {
          // Update existing entry
          await journalEntry.update(r => {
            r.title = title.trim() || undefined;
            r.content = content.trim();
            r.entryDate = entryDate.getTime();
            r.storyChips = Array.from(selectedChips).map(chipId => ({ chipId }));
            r.updatedAt = new Date();
          });

          // Update friends - remove old links
          const links = await database.get<JournalEntryFriend>('journal_entry_friends')
            .query(Q.where('journal_entry_id', journalEntry.id))
            .fetch();

          for (const link of links) {
            await link.destroyPermanently();
          }

        } else {
          // Create new entry
          journalEntry = await database.get<JournalEntry>('journal_entries').create(r => {
            r.title = title.trim() || undefined;
            r.content = content.trim();
            r.entryDate = entryDate.getTime();
            r.storyChips = Array.from(selectedChips).map(chipId => ({ chipId }));
          });
        }

        targetId = journalEntry.id;

        // Create new friend links
        if (journalEntry) {
          const friendsCollection = database.get<JournalEntryFriend>('journal_entry_friends');
          for (const friendId of Array.from(selectedFriendIds)) {
            await friendsCollection.create(link => {
              link.journalEntryId = journalEntry!.id;
              link.friendId = friendId;
            });
          }
        }
      });

      // TRIGGER SILENT AUDIT
      // Queue this entry for background action detection
      if (targetId) {
        actionExtractionService.queueEntry(targetId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave();
      onClose();
    } catch (error) {
      logger.error('JournalEntry', 'Error saving journal entry:', error);
    }
  };

  const handleClose = () => {
    // Check for unsaved changes (content modified from original or new entry with content)
    const hasChanges = entry
      ? content.trim() !== entry.content || title !== (entry.title || '')
      : content.trim().length > 0;

    if (hasChanges) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes that will be lost.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Keyboard.dismiss();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            },
          },
        ]
      );
    } else {
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  };

  const handleDelete = () => {
    if (!entry) return;

    Alert.alert(
      'Delete Entry?',
      'This journal entry will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                // Use the cascading delete method to remove entry and friend links
                const deleteOp = await entry.prepareDestroyWithChildren();
                await database.batch(deleteOp);
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onDelete?.();
              onClose();
            } catch (error) {
              logger.error('JournalEntry', 'Error deleting journal entry:', error);
              Alert.alert('Error', 'Failed to delete entry. Please try again.');
            }
          },
        },
      ]
    );
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
    <StandardBottomSheet
      visible={isOpen}
      onClose={handleClose}
      height="full"
      disableContentPanning
      title={isEditMode ? 'Edit Entry' : 'New Journal Entry'}
    >
      {/* Header Actions */}
      <View className="flex-row justify-between items-center px-5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {/* Delete Button (only in edit mode) */}
        {isEditMode ? (
          <TouchableOpacity
            onPress={handleDelete}
            className="p-2 rounded-lg"
            style={{ backgroundColor: colors.destructive + '15' }}
          >
            <Trash2 size={20} color={colors.destructive} />
          </TouchableOpacity>
        ) : (
          <View />
        )}

        {/* Save Button */}
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
      </View>

      <BottomSheetScrollView
        className="flex-1 px-5 py-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Linked Weave Banner */}
        {linkedWeaveInfo && (
          <TouchableOpacity
            onPress={handleViewOriginalWeave}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl mb-4"
            style={{ backgroundColor: colors.primary + '15' }}
          >
            <View className="flex-1">
              <Text
                className="text-xs font-medium"
                style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
              >
                Linked to weave
              </Text>
              <Text
                className="text-sm"
                style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                numberOfLines={1}
              >
                {linkedWeaveInfo.activityLabel} with {linkedWeaveInfo.friendName}
              </Text>
            </View>
            <ExternalLink size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

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
          <BottomSheetInput
            value={title}
            onChangeText={setTitle}
            placeholder="Give this entry a title..."
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
          <BottomSheetInput
            value={content}
            onChangeText={setContent}
            placeholder="Write your thoughts..."
            multiline
            numberOfLines={8}
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
          <BottomSheetScrollView
            horizontal
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
          </BottomSheetScrollView>
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
                logger.debug('JournalEntry', 'Custom chip created, pattern reload triggered');
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
      </BottomSheetScrollView>
    </StandardBottomSheet>
  );
}
