import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { type Vibe } from './types';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type InteractionCategory } from './types';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { MoonPhaseSelector } from '@/components/MoonPhaseSelector';

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

  // Track the pending action to execute after close animation
  const pendingActionRef = useRef<'save' | 'skip' | null>(null);
  const pendingDataRef = useRef<{ vibe?: Vibe; notes?: string; title?: string } | null>(null);

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
    pendingActionRef.current = 'save';
    pendingDataRef.current = {
      vibe: selectedVibe || undefined,
      notes: notes.trim() || undefined,
      title: title.trim() || activityLabel,
    };
    onSkip(); // This triggers close - we'll handle the actual save in onCloseComplete
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    pendingActionRef.current = 'skip';
    onSkip();
  };

  const handleCloseComplete = () => {
    // Execute the pending action
    if (pendingActionRef.current === 'save' && pendingDataRef.current) {
      onSave(pendingDataRef.current);
    }
    // Reset state
    setSelectedVibe(null);
    setNotes('');
    setTitle('');
    pendingActionRef.current = null;
    pendingDataRef.current = null;
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
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.activityText, { color: colors['muted-foreground'] }]}>
            Logged
          </Text>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Interaction Title"
            placeholderTextColor={colors['muted-foreground'] + '80'}
            returnKeyType="done"
          />
          <Text style={[styles.friendNameText, { color: colors.foreground }]}>
            with {friendName}
          </Text>
        </View>

        {/* Prompt */}
        <Text style={[styles.promptText, { color: colors.foreground }]}>
          {getPrompt()}
        </Text>

        {/* Moon Phase Selector */}
        <View style={styles.moonContainer}>
          <MoonPhaseSelector
            selectedVibe={selectedVibe}
            onSelect={handleVibeSelect}
          />
        </View>

        {/* Optional Note */}
        <View style={styles.noteSection}>
          <Text style={[styles.noteLabel, { color: colors['muted-foreground'] }]}>
            Optional: Add a note
          </Text>
          <TextInput
            style={[
              styles.noteInput,
              {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="What happened? How are you feeling?"
            placeholderTextColor={colors['muted-foreground'] + '80'}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.skipButton, { borderColor: colors.border }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipButtonText, { color: colors['muted-foreground'] }]}>
              Skip
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    textAlign: 'center',
    marginBottom: 4,
    minWidth: 200,
  },
  friendNameText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.8,
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  moonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  noteSection: {
    marginBottom: 24,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    maxHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
