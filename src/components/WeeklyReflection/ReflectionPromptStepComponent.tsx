/**
 * ReflectionPromptStep
 * 
 * Screen 1 of the Sunday check-in flow.
 * Shows one contextual prompt based on the week's data.
 * Writing is optional but encouraged. Chips are detected from text.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Edit3, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  ReflectionPrompt,
  detectChipsFromText,
  DetectedChip,
  getDefaultChipsForPromptType,
  STORY_CHIPS,
} from '@/modules/reflection';
import * as Haptics from 'expo-haptics';

interface ReflectionPromptStepProps {
  prompt: ReflectionPrompt;
  onNext: (text: string, selectedChipIds: string[]) => void;
}

export function ReflectionPromptStep({ prompt, onNext }: ReflectionPromptStepProps) {
  const { colors } = useTheme();

  const [text, setText] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState<Set<string>>(new Set());
  const [detectedChips, setDetectedChips] = useState<DetectedChip[]>([]);
  const [showChips, setShowChips] = useState(false);

  // Detect chips from text with debounce
  useEffect(() => {
    if (text.length < 10) {
      setDetectedChips([]);
      setShowChips(false);
      return;
    }

    const timer = setTimeout(() => {
      const detected = detectChipsFromText(text);
      setDetectedChips(detected);
      setShowChips(detected.length > 0);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [text]);

  // Get chips to display (either detected or defaults from prompt)
  const displayChips = useMemo(() => {
    if (detectedChips.length > 0) {
      return detectedChips.map(d => d.chip);
    }

    // If no text yet, show suggested chips from prompt
    if (text.length < 10 && prompt.suggestedChipIds && prompt.suggestedChipIds.length > 0) {
      return prompt.suggestedChipIds
        .map(id => STORY_CHIPS.find(c => c.id === id))
        .filter((c): c is typeof STORY_CHIPS[0] => c !== undefined)
        .slice(0, 2);
    }

    return [];
  }, [detectedChips, text, prompt.suggestedChipIds]);

  const toggleChip = useCallback((chipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChipIds(prev => {
      const next = new Set(prev);
      if (next.has(chipId)) {
        next.delete(chipId);
      } else {
        next.add(chipId);
      }
      return next;
    });
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext(text.trim(), Array.from(selectedChipIds));
  };

  const hasContent = text.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={100}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 justify-between">
          {/* Top Section - Prompt */}
          <View className="flex-1 justify-center px-2">
            {/* Icon */}
            <View className="items-center mb-6">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                <Edit3 size={24} color={colors.primary} />
              </View>
            </View>

            {/* Prompt Question */}
            <View>
              <Text
                className="text-xl text-center leading-7 mb-8 px-4"
                style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
              >
                {prompt.question}
              </Text>
            </View>

            {/* Text Input */}
            <View>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Write something... (optional)"
                placeholderTextColor={colors['muted-foreground']}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="px-4 py-4 rounded-2xl text-base"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.foreground,
                  fontFamily: 'Inter_400Regular',
                  minHeight: 120,
                  maxHeight: 200,
                }}
              />
            </View>

            {/* Detected/Suggested Chips */}
            {displayChips.length > 0 && (
              <View className="mt-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Sparkles size={14} color={colors['muted-foreground']} />
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {detectedChips.length > 0 ? 'Add a theme?' : 'Suggested themes'}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {displayChips.map((chip) => {
                    const isSelected = selectedChipIds.has(chip.id);

                    return (
                      <TouchableOpacity
                        key={chip.id}
                        onPress={() => toggleChip(chip.id)}
                        className="px-4 py-2.5 rounded-full"
                        style={{
                          backgroundColor: isSelected ? colors.primary + '20' : colors.muted,
                          borderWidth: isSelected ? 1.5 : 0,
                          borderColor: isSelected ? colors.primary : 'transparent',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-sm"
                          style={{
                            color: isSelected ? colors.primary : colors.foreground,
                            fontFamily: 'Inter_500Medium',
                          }}
                        >
                          {chip.plainText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Bottom Section - Continue Button */}
          <View className="pt-4 pb-2">
            <TouchableOpacity
              onPress={handleContinue}
              className="py-4 rounded-2xl items-center flex-row justify-center"
              style={{ backgroundColor: colors.primary }}
              activeOpacity={0.8}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
              >
                {hasContent ? 'Continue' : 'Skip writing'}
              </Text>
            </TouchableOpacity>

            {!hasContent && (
              <Text
                className="text-xs text-center mt-3"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                You can always add a reflection later
              </Text>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
