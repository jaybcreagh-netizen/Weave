/**
 * GratitudePrompt Component
 * Gratitude journaling for weekly reflection with contextual prompts
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sparkles, Check, Lightbulb, Plus } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { WeeklySummary } from '../../lib/weekly-reflection/weekly-stats';
import { generateContextualPrompts, selectBestPrompt } from '../../lib/weekly-reflection/contextual-prompts';
import { WeekStoryChipSuggestion } from '../../lib/weekly-reflection/story-chip-aggregator';
import { STORY_CHIPS } from '../../lib/story-chips';
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
    // Pre-select top 3 suggested chips
    new Set(storyChipSuggestions.slice(0, 3).map(s => s.chipId))
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
            className="text-2xl font-bold text-center mb-2"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            Moment of Gratitude
          </Text>
          <Text
            className="text-sm text-center leading-5 px-6"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Take a moment to reflect on the connections that nourished you.
          </Text>
        </Animated.View>

        {/* Prompt Card */}
        <Animated.View
          entering={FadeIn.delay(100)}
          className="mb-6 p-6 rounded-2xl"
          style={{ backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30', borderWidth: 1 }}
        >
          <View className="flex-row items-start mb-2">
            <Lightbulb size={16} color={colors.secondary} style={{ marginTop: 2, marginRight: 8 }} />
            <Text
              className="text-xs font-medium flex-1"
              style={{ color: colors.secondary, fontFamily: 'Inter_500Medium' }}
            >
              {contextualPrompt.context}
            </Text>
          </View>
          <Text
            className="text-base leading-6 italic"
            style={{ color: colors.foreground, fontFamily: 'Lora_400Regular' }}
          >
            "{contextualPrompt.prompt}"
          </Text>
        </Animated.View>

        {/* Story Chips Selector */}
        {displayChips.length > 0 && (
          <Animated.View entering={FadeIn.delay(150)} className="mb-6">
            <Text
              className="text-sm font-medium mb-3"
              style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
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
                    className="px-4 py-2 rounded-full"
                    style={{
                      backgroundColor: isSelected ? colors.primary + '20' : colors.muted,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: isSelected ? colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm"
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
              {!showAllChips && storyChipSuggestions.length < STORY_CHIPS.length && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAllChips(true);
                  }}
                  className="px-4 py-2 rounded-full flex-row items-center"
                  style={{ backgroundColor: colors.muted }}
                >
                  <Plus size={14} color={colors['muted-foreground']} style={{ marginRight: 4 }} />
                  <Text
                    className="text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    More
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text
              className="text-xs mt-2 px-1"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
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
            className="p-4 rounded-xl text-base min-h-[160px]"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.foreground,
              fontFamily: 'Inter_400Regular',
            }}
          />
          <Text
            className="text-xs mt-2 px-1"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Optional • Your reflections are private
          </Text>
        </Animated.View>

        {/* Benefits Card */}
        <Animated.View
          entering={FadeIn.delay(300)}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-xs font-semibold mb-2"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            💡 WHY GRATITUDE MATTERS
          </Text>
          <Text
            className="text-xs leading-5"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
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
            className="text-base font-semibold ml-2"
            style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            {gratitudeText.trim().length > 0 ? 'Complete Reflection' : 'Complete Without Writing'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
