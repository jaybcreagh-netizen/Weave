/**
 * ReflectionDetailModal
 * View and edit a past weekly reflection
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Edit3, Save, Calendar, TrendingUp, Plus, Users } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import WeeklyReflection from '../../db/models/WeeklyReflection';
import { database } from '../../db';
import { STORY_CHIPS } from '../../lib/story-chips';
import { getFriendsForReflection, ReflectionFriend } from '../../lib/weekly-reflection/reflection-friends';
import * as Haptics from 'expo-haptics';

interface ReflectionDetailModalProps {
  reflection: WeeklyReflection | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ReflectionDetailModal({ reflection, isOpen, onClose, onUpdate }: ReflectionDetailModalProps) {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedGratitudeText, setEditedGratitudeText] = useState('');
  const [editedStoryChips, setEditedStoryChips] = useState<Set<string>>(new Set());
  const [showAllChips, setShowAllChips] = useState(false);
  const [friends, setFriends] = useState<ReflectionFriend[]>([]);

  React.useEffect(() => {
    if (reflection && isOpen) {
      setEditedGratitudeText(reflection.gratitudeText || '');
      setEditedStoryChips(new Set(reflection.storyChips.map(c => c.chipId)));
      setIsEditing(false);
      setShowAllChips(false);
      loadFriends(reflection);
    }
  }, [reflection, isOpen]);

  const loadFriends = async (reflection: WeeklyReflection) => {
    const reflectionFriends = await getFriendsForReflection(reflection);
    setFriends(reflectionFriends);
  };

  const handleSave = async () => {
    if (!reflection) return;
    try {
      await database.write(async () => {
        await reflection.update(rec => {
          rec.gratitudeText = editedGratitudeText.trim().length > 0 ? editedGratitudeText : undefined;
          rec.storyChips = Array.from(editedStoryChips).map(chipId => ({ chipId }));
        });
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating reflection:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const toggleChip = (chipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditedStoryChips(prev => {
      const next = new Set(prev);
      if (next.has(chipId)) {
        next.delete(chipId);
      } else {
        next.add(chipId);
      }
      return next;
    });
  };

  const displayChips = useMemo(() => {
    if (!showAllChips) {
      // Show only selected chips when not editing, or selected + common chips when editing
      const selected = Array.from(editedStoryChips)
        .map(chipId => STORY_CHIPS.find(c => c.id === chipId))
        .filter((c): c is typeof STORY_CHIPS[0] => c !== undefined);

      if (isEditing && selected.length < 8) {
        // Add some common chips
        const commonChips = STORY_CHIPS.filter(c => !editedStoryChips.has(c.id)).slice(0, 8 - selected.length);
        return [...selected, ...commonChips];
      }

      return selected;
    }

    return STORY_CHIPS;
  }, [editedStoryChips, isEditing, showAllChips]);

  return (
    <Modal
      visible={isOpen && reflection !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {reflection && (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View className="flex-1">
              <Text
                className="text-lg font-semibold"
                style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
              >
                {reflection.getWeekRange()}
            </Text>
            <Text
              className="text-xs mt-0.5"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              {reflection.getDaysAgo() === 0
                ? 'This week'
                : reflection.getDaysAgo() < 7
                ? `${reflection.getDaysAgo()}d ago`
                : `${Math.floor(reflection.getDaysAgo() / 7)}w ago`}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {isEditing ? (
              <TouchableOpacity
                onPress={handleSave}
                className="px-4 py-2 rounded-xl flex-row items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Save size={16} color={colors['primary-foreground']} />
                <Text
                  className="text-sm font-semibold ml-1.5"
                  style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                >
                  Save
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditing(true);
                }}
                className="p-2"
              >
                <Edit3 size={20} color={colors.foreground} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} className="p-2">
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Stats Grid */}
            <View className="flex-row gap-3 mb-4">
              <View
                className="flex-1 p-3 rounded-xl"
                style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
              >
                <Text
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {reflection.totalWeaves}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Weaves
                </Text>
              </View>

              <View
                className="flex-1 p-3 rounded-xl"
                style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
              >
                <Text
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {reflection.friendsContacted}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Friends
                </Text>
              </View>

              <View
                className="flex-1 p-3 rounded-xl"
                style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
              >
                <Text
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {reflection.missedFriendsCount}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Missed
                </Text>
              </View>
            </View>

            {/* Friends Contacted */}
            {friends.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Users size={14} color={colors['muted-foreground']} />
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    Friends Contacted
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {friends.map(({friend, interactionCount}) => (
                    <View
                      key={friend.id}
                      className="px-3 py-2 rounded-xl"
                      style={{ backgroundColor: colors.muted }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                      >
                        {friend.name}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {interactionCount}× this week
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Top Activity */}
            {reflection.topActivity && (
              <View className="mb-4">
                <Text
                  className="text-xs mb-2"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Top Activity
                </Text>
                <View
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: colors.muted }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                  >
                    {reflection.topActivity} ({reflection.topActivityCount}×)
                  </Text>
                </View>
              </View>
            )}

            {/* Story Chips */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Week Themes
                </Text>
                {isEditing && (
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    Tap to add/remove
                  </Text>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2">
                {displayChips.map(chip => {
                  const isSelected = editedStoryChips.has(chip.id);

                  return (
                    <TouchableOpacity
                      key={chip.id}
                      onPress={() => isEditing && toggleChip(chip.id)}
                      disabled={!isEditing}
                      className="px-3 py-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? colors.primary + '15' : colors.muted,
                        borderWidth: isEditing && isSelected ? 1 : 0,
                        borderColor: isEditing && isSelected ? colors.primary : 'transparent',
                      }}
                    >
                      <Text
                        className="text-xs"
                        style={{
                          color: isSelected ? colors.primary : colors['muted-foreground'],
                          fontFamily: 'Inter_400Regular',
                        }}
                      >
                        {chip.plainText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {isEditing && !showAllChips && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAllChips(true);
                    }}
                    className="px-3 py-1.5 rounded-full flex-row items-center"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <Plus size={12} color={colors['muted-foreground']} style={{ marginRight: 4 }} />
                    <Text
                      className="text-xs"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    >
                      More
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Gratitude Prompt */}
            {reflection.gratitudePrompt && (
              <View
                className="mb-4 p-3 rounded-xl"
                style={{ backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30', borderWidth: 1 }}
              >
                <Text
                  className="text-xs font-medium mb-1"
                  style={{ color: colors.secondary, fontFamily: 'Inter_500Medium' }}
                >
                  Prompt: "{reflection.gratitudePrompt}"
                </Text>
                {reflection.promptContext && (
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {reflection.promptContext}
                  </Text>
                )}
              </View>
            )}

            {/* Gratitude Text */}
            <View className="mb-4">
              <Text
                className="text-xs mb-2"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Gratitude Entry
              </Text>
              {isEditing ? (
                <TextInput
                  value={editedGratitudeText}
                  onChangeText={setEditedGratitudeText}
                  placeholder="Write what comes to mind..."
                  placeholderTextColor={colors['muted-foreground']}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  className="p-4 rounded-xl text-base min-h-[160px]"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.foreground,
                    fontFamily: 'Lora_400Regular',
                  }}
                />
              ) : (
                <View
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: colors.secondary + '10' }}
                >
                  {editedGratitudeText.trim().length > 0 ? (
                    <Text
                      className="text-base leading-6 italic"
                      style={{ color: colors.foreground, fontFamily: 'Lora_400Regular' }}
                    >
                      "{editedGratitudeText}"
                    </Text>
                  ) : (
                    <Text
                      className="text-sm italic"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    >
                      No gratitude entry for this week
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </Modal>
  );
}
