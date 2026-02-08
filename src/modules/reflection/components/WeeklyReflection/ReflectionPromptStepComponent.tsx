/**
 * ReflectionPromptStep
 * 
 * Screen 1 of the Sunday check-in flow.
 * Shows one contextual prompt based on the week's data.
 * Writing is optional but encouraged. Chips are detected from text.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, TouchableOpacity, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Sparkles, PenLine } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { NetworkObservationCard } from './NetworkObservationCard';
import ProactiveInsight from '@/db/models/ProactiveInsight';
import {
  ReflectionPrompt,
  detectChipsFromText,
  DetectedChip,
  PromptEngineInput,
} from '../../services/prompt-engine';
import { ReflectionAssistant } from '@/modules/journal/services/reflection-assistant.service';
import { STORY_CHIPS } from '../../services/story-chips.service';
import * as Haptics from 'expo-haptics';

interface ReflectionPromptStepProps {
  prompt: ReflectionPrompt;
  promptEngineInput?: PromptEngineInput;
  insights?: ProactiveInsight[];
  observations?: string[];
  narrative?: string | null;
  onNext: (text: string, selectedChipIds: string[]) => void;
}

export function ReflectionPromptStep({ prompt, promptEngineInput, insights = [], observations = [], narrative, onNext }: ReflectionPromptStepProps) {
  const { colors } = useTheme();
  const inputRef = useRef<any>(null);

  const [text, setText] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState<Set<string>>(new Set());
  const [detectedChips, setDetectedChips] = useState<DetectedChip[]>([]);
  const [showChips, setShowChips] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  const handleHelpMeWrite = async () => {
    if (!promptEngineInput) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDrafting(true);
    try {
      const draft = await ReflectionAssistant.generateDraft(
        promptEngineInput,
        prompt.question,
        { observations, narrative: narrative || undefined },
      );
      setText(draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to generate draft:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDrafting(false);
    }
  };

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
    <View className="flex-1">
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8 }}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View>
            {/* Icon */}
            <View className="items-center mb-6 mt-2">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                <PenLine size={24} color={colors.primary} />
              </View>
            </View>

            {/* Network Observations */}
            {observations && observations.length > 0 && (
              <View className="mb-6">
                <NetworkObservationCard observations={observations} />
              </View>
            )}

            {/* Prompt Question */}
            <Text variant="h3" className="text-center leading-7 mb-4 px-4 font-lora-medium">
              {prompt.question}
            </Text>

            {/* Help Me Write Button */}
            {promptEngineInput && !text && (
              <TouchableOpacity
                onPress={handleHelpMeWrite}
                disabled={isDrafting}
                className="self-center flex-row items-center gap-2 px-3 py-1.5 rounded-full mb-6"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                {isDrafting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Sparkles size={14} color={colors.primary} />
                )}
                <Text variant="caption" weight="medium" style={{ color: colors.primary }}>
                  {isDrafting ? 'Writing...' : 'Help me write'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Text Input */}
            <BottomSheetTextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Write something... (optional)"
              placeholderTextColor={colors['muted-foreground']}
              multiline
              style={{
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 16,
                minHeight: 120,
                maxHeight: 200,
                textAlignVertical: 'top',
                fontSize: 16,
                fontFamily: 'Inter_400Regular',
              }}
            />

            {/* Detected/Suggested Chips */}
            {displayChips.length > 0 && (
              <View className="mt-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <Sparkles size={14} color={colors['muted-foreground']} />
                  <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
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
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : 'transparent',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          variant="body"
                          weight="medium"
                          style={{ color: isSelected ? colors.primary : colors.foreground }}
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
        </TouchableWithoutFeedback>
      </BottomSheetScrollView>

      {/* Bottom Section - Continue Button (pinned) */}
      <View className="px-2 pt-4 pb-2">
        <Button
          onPress={handleContinue}
          variant="primary"
          className="w-full"
          label={hasContent ? 'Continue' : 'Skip writing'}
        />

        {!hasContent && (
          <Text variant="caption" className="text-center mt-3" style={{ color: colors['muted-foreground'] }}>
            You can always add a reflection later
          </Text>
        )}
      </View>
    </View>
  );
}
