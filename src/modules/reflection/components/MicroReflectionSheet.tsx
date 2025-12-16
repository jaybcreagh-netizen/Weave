import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { type Vibe, type InteractionCategory } from '@/shared/types/common';

import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { MoonPhaseSelector } from '@/modules/intelligence';

interface MicroReflectionSheetProps {
  isVisible: boolean;
  friendName: string;
  activityLabel: string;
  activityId: string;
  friendArchetype?: string;
  onSave: (data: { vibe?: Vibe; notes?: string; title?: string }) => void;
  onSkip: () => void;
}

export function MicroReflectionSheet({
  isVisible,
  friendName,
  activityLabel,
  activityId,
  friendArchetype,
  onSave,
  onSkip,
}: MicroReflectionSheetProps) {
  const { colors, isDarkMode } = useTheme();
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState(activityLabel);


  // Set title from activityLabel when opening
  useEffect(() => {
    if (isVisible) {
      if (activityLabel && activityLabel.includes('-')) {
        const metadata = getCategoryMetadata(activityLabel as InteractionCategory);
        if (metadata && metadata.label) {
          setTitle(metadata.label);
          return;
        }
      }
      setTitle(activityLabel);
    }
  }, [isVisible, activityLabel]);

  const handleVibeSelect = (vibe: Vibe) => {
    setSelectedVibe(vibe);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    Keyboard.dismiss();
    // Call onSave directly - the parent's handleSave will close the sheet after saving
    onSave({
      vibe: selectedVibe || undefined,
      notes: notes.trim() || undefined,
      title: title.trim() || activityLabel,
    });
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    onSkip();
  };

  const handleCloseComplete = () => {
    // Reset state after close animation completes
    setSelectedVibe(null);
    setNotes('');
    setTitle('');
  };

  const getPrompt = () => {
    const archetypePrompts: Record<string, string> = {
      'The Sun': 'How was the joy shared?',
      'The Hermit': 'What depth did you find?',
      'The Fool': 'What adventure unfolded?',
      'The Empress': 'How did you nurture each other?',
      'The Magician': 'What magic happened?',
      'The High Priestess': 'What truth emerged?',
      'The Emperor': 'How did you support each other?',
    };

    return friendArchetype && archetypePrompts[friendArchetype]
      ? archetypePrompts[friendArchetype]
      : 'How did it feel?';
  };

  return (
    <AnimatedBottomSheet
      visible={isVisible}
      onClose={handleSkip}
      onCloseComplete={handleCloseComplete}
      height="full"
      scrollable
    >
      {/* Header */}
      <View className="items-center mb-4">
        <Text className="text-sm font-medium mb-2" style={{ color: colors['muted-foreground'] }}>
          Logged
        </Text>
        <TextInput
          className="text-2xl font-bold font-lora-bold text-center mb-1 min-w-[200px]"
          style={{ color: colors.foreground }}
          value={title}
          onChangeText={setTitle}
          placeholder="Interaction Title"
          placeholderTextColor={colors['muted-foreground'] + '80'}
          returnKeyType="done"
        />
        <Text className="text-base font-semibold font-inter-semibold opacity-80" style={{ color: colors.foreground }}>
          with {friendName}
        </Text>
      </View>

      {/* Prompt */}
      <Text className="text-lg font-semibold text-center mb-6" style={{ color: colors.foreground }}>
        {getPrompt()}
      </Text>

      {/* Moon Phase Selector */}
      <View className="w-full mb-5">
        <MoonPhaseSelector
          selectedVibe={selectedVibe}
          onSelect={handleVibeSelect}
        />
      </View>

      {/* Optional Note */}
      <View className="mb-6">
        <Text className="text-[13px] font-medium mb-2" style={{ color: colors['muted-foreground'] }}>
          Optional: Add a note
        </Text>
        <TextInput
          className="border rounded-xl p-3 text-[15px] min-h-[80px] max-h-[120px]"
          style={{
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            color: colors.foreground,
            borderColor: colors.border,
            textAlignVertical: 'top'
          }}
          placeholder="What happened? How are you feeling?"
          placeholderTextColor={colors['muted-foreground'] + '80'}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          returnKeyType="done"
          blurOnSubmit
        />
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 py-4 rounded-xl border-[1.5px] items-center justify-center"
          style={{ borderColor: colors.border }}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold" style={{ color: colors['muted-foreground'] }}>
            Skip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 py-4 rounded-xl items-center justify-center shadow-sm elevation-4"
          style={{ backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text className="text-base font-bold" style={{ color: colors['primary-foreground'] }}>
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </AnimatedBottomSheet>
  );
}
