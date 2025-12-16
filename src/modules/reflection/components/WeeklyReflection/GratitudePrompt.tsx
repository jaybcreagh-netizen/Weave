/**
 * GratitudePrompt Component
 * Gratitude journaling for weekly reflection with contextual prompts
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sparkles, Check, Lightbulb, Plus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeeklySummary, generateContextualPrompts, selectBestPrompt, WeekStoryChipSuggestion } from '@/modules/reflection';
import { STORY_CHIPS } from '@/modules/reflection';
import * as Haptics from 'expo-haptics';

interface GratitudePromptProps {
  summary: WeeklySummary;
  storyChipSuggestions: WeekStoryChipSuggestion[];
  onComplete: (gratitudeText: string, prompt: string, promptContext: string, storyChips: Array<{ chipId: string; customText?: string }>) => void;
}

export function GratitudePrompt({ summary, storyChipSuggestions, onComplete }: GratitudePromptProps) {
  const { colors } = useTheme();
  const [gratitudeText, setGratitudeText] = useState('');
  const [selectedChips, setSelectedChips] = useState<Set<string>>(
    new Set(storyChipSuggestions.map(s => s.chipId))
  );
  const [showAllChips, setShowAllChips] = useState(false);

  // Generate contextual prompts based on weekly summary
  const contextualPrompt = useMemo(() => {
    const prompts = generateContextualPrompts(summary);
    return selectBestPrompt(prompts);
  }, [summary]);

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const storyChips = Array.from(selectedChips).map(chipId => ({ chipId }));
    onComplete(gratitudeText, contextualPrompt.prompt, contextualPrompt.context, storyChips);
  };

  const toggleChip = (chipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChips(prev => {
      const next = new Set(prev);
      if (next.has(chipId)) {
        next.delete(chipId);
      } else {
        next.add(chipId);
      }
      return next;
    });
  };

  // Show suggested chips first, then all other chips if expanded
  const displayChips = useMemo(() => {
    const suggested = storyChipSuggestions.map(s => s.chip);
    if (!showAllChips) return suggested;

    // Add all other chips not in suggestions
    const suggestedIds = new Set(suggested.map(c => c.id));
    const otherChips = STORY_CHIPS.filter(c => !suggestedIds.has(c.id));
    return [...suggested, ...otherChips];
  }, [storyChipSuggestions, showAllChips]);

  const canComplete = gratitudeText.trim().length > 0 || true; // Allow skipping

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeIn} className="mb-6 items-center">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Sparkles size={32} color={colors.primary} />
          </View>
          <Text
            className="text-2xl font-bold font-lora-bold text-center mb-2"
            style={{ color: colors.foreground }}
          >
            Moment of Gratitude
          </Text>
          <Text
            className="text-sm text-center leading-5 px-6 font-inter-regular"
            style={{ color: colors['muted-foreground'] }}
          >
            Take a moment to reflect on the connections that nourished you.
          </Text>
        </Animated.View>

        {/* Prompt Card */}
        <Animated.View
          entering={FadeIn.delay(100)}
          className="mb-6 p-6 rounded-2xl border"
          style={{
            backgroundColor: colors.secondary + '15',
            borderColor: colors.secondary + '30'
          }}
        >
          <View className="flex-row items-start mb-2">
            <Lightbulb size={16} color={colors.secondary} style={{ marginTop: 2, marginRight: 8 }} />
            <Text
              className="text-xs font-medium font-inter-medium flex-1"
              style={{ color: colors.secondary }}
            >
              {contextualPrompt.context}
            </Text>
          </View>
          <Text
            className="text-base leading-6 italic font-lora-regular"
            style={{ color: colors.foreground }}
          >
            "{contextualPrompt.prompt}"
          </Text>
        </Animated.View>

        {/* Story Chips Selector */}
        {displayChips.length > 0 && (
          <Animated.View entering={FadeIn.delay(150)} className="mb-6">
            <Text
              className="text-sm font-medium font-inter-medium mb-3"
              style={{ color: colors.foreground }}
            >
              What stood out this week?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {displayChips.map((chip) => {
                const isSelected = selectedChips.has(chip.id);
                const isSuggested = storyChipSuggestions.some(s => s.chipId === chip.id);

                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => toggleChip(chip.id)}
                    className="px-4 py-2 rounded-full border-[1.5px]"
                    style={{
                      backgroundColor: isSelected ? colors.primary + '20' : colors.muted,
                      borderColor: isSelected ? colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm font-inter-regular"
                      style={{
                        color: isSelected ? colors.primary : colors['muted-foreground'],
                      }}
                    >
                      {chip.plainText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {!showAllChips && storyChipSuggestions.length < STORY_CHIPS.length && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAllChips(true);
                  }}
                  className="px-4 py-2 rounded-full flex-row items-center bg-muted"
                >
                  <Plus size={14} color={colors['muted-foreground']} style={{ marginRight: 4 }} />
                  <Text
                    className="text-sm font-inter-regular"
                    style={{ color: colors['muted-foreground'] }}
                  >
                    More
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text
              className="text-xs mt-2 px-1 font-inter-regular"
              style={{ color: colors['muted-foreground'] }}
            >
              {storyChipSuggestions.length > 0
                ? 'Based on your reflections this week • Tap to add or remove'
                : 'Tap to capture themes from your week'}
            </Text>
          </Animated.View>
        )}

        {/* Text Input */}
        <Animated.View
          entering={FadeIn.delay(200)}
          className="mb-6"
        >
          <TextInput
            value={gratitudeText}
            onChangeText={setGratitudeText}
            placeholder="Write what comes to mind..."
            placeholderTextColor={colors['muted-foreground']}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            className="p-4 rounded-xl text-base min-h-[160px] border font-inter-regular"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            }}
          />
          <Text
            className="text-xs mt-2 px-1 font-inter-regular"
            style={{ color: colors['muted-foreground'] }}
          >
            Optional • Your reflections are private
          </Text>
        </Animated.View>

        {/* Benefits Card */}
        <Animated.View
          entering={FadeIn.delay(300)}
          className="mb-6 p-4 rounded-xl bg-muted"
        >
          <Text
            className="text-xs font-semibold font-inter-semibold mb-2"
            style={{ color: colors['muted-foreground'] }}
          >
            💡 WHY GRATITUDE MATTERS
          </Text>
          <Text
            className="text-xs leading-5 font-inter-regular"
            style={{ color: colors['muted-foreground'] }}
          >
            Reflecting on positive moments strengthens your relationships and increases your sense of connection. Regular gratitude practice has been shown to improve emotional well-being and relationship satisfaction.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Complete Button */}
      <Animated.View entering={FadeIn.delay(400)} className="pt-4">
        <TouchableOpacity
          onPress={handleComplete}
          disabled={!canComplete}
          className="py-4 rounded-xl items-center flex-row justify-center"
          style={{
            backgroundColor: canComplete ? colors.primary : colors.muted,
            opacity: canComplete ? 1 : 0.5,
          }}
        >
          <Check size={20} color={colors['primary-foreground']} />
          <Text
            className="text-base font-semibold font-inter-semibold ml-2"
            style={{ color: colors['primary-foreground'] }}
          >
            {gratitudeText.trim().length > 0 ? 'Complete Reflection' : 'Complete Without Writing'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
