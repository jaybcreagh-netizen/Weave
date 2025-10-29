import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../hooks/useTheme';
import { type Vibe } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

interface MicroReflectionSheetProps {
  isVisible: boolean;
  friendName: string;
  activityLabel: string;
  activityId: string;
  friendArchetype?: string;
  onSave: (data: { vibe?: Vibe; notes?: string }) => void;
  onSkip: () => void;
}

const MOON_PHASES: { vibe: Vibe; emoji: string; label: string }[] = [
  { vibe: 'NewMoon', emoji: '🌑', label: 'New Moon' },
  { vibe: 'WaxingCrescent', emoji: '🌘', label: 'Waxing' },
  { vibe: 'FirstQuarter', emoji: '🌗', label: 'Half' },
  { vibe: 'WaxingGibbous', emoji: '🌖', label: 'Gibbous' },
  { vibe: 'FullMoon', emoji: '🌕', label: 'Full Moon' },
];

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

  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Auto-dismiss timer
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        handleSkip();
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Entrance animation
  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, {
        damping: 25,
        stiffness: 200,
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 });
    }
  }, [isVisible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const handleVibeSelect = (vibe: Vibe) => {
    setSelectedVibe(vibe);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
        runOnJS(resetState)();
      }
    });
  };

  const handleSave = () => {
    animateOut(() => {
      onSave({
        vibe: selectedVibe || undefined,
        notes: notes.trim() || undefined,
      });
    });
  };

  const handleSkip = () => {
    animateOut(() => {
      onSkip();
    });
  };

  const resetState = () => {
    setSelectedVibe(null);
    setNotes('');
  };

  const getPrompt = () => {
    // Archetype-aware prompts
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

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={handleSkip}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleSkip}
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </TouchableOpacity>
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <BlurView
            intensity={isDarkMode ? 60 : 100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.sheetBlur}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.sheetContent, { backgroundColor: isDarkMode ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: colors['muted-foreground'] }]} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.activityText, { color: colors['muted-foreground'] }]}>
                  ✨ You just had {activityLabel.toLowerCase()}
                </Text>
                <Text style={[styles.friendNameText, { color: colors.foreground }]}>
                  {friendName}
                </Text>
              </View>

              {/* Prompt */}
              <Text style={[styles.promptText, { color: colors.foreground }]}>
                {getPrompt()}
              </Text>

              {/* Moon Phase Selector */}
              <View style={styles.moonContainer}>
                {MOON_PHASES.map(({ vibe, emoji, label }) => {
                  const isSelected = selectedVibe === vibe;
                  return (
                    <TouchableOpacity
                      key={vibe}
                      style={[
                        styles.moonButton,
                        isSelected && {
                          backgroundColor: isDarkMode ? colors.primary + '20' : colors.primary + '15',
                          borderColor: colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => handleVibeSelect(vibe)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.moonEmoji,
                          !isSelected && { opacity: 0.4 },
                        ]}
                      >
                        {emoji}
                      </Text>
                      <Text
                        style={[
                          styles.moonLabel,
                          { color: isSelected ? colors.primary : colors['muted-foreground'] },
                          !isSelected && { opacity: 0.5 },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
                    Save ✨
                  </Text>
                </TouchableOpacity>
              </View>
              </View>
            </TouchableWithoutFeedback>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetBlur: {
    flex: 1,
  },
  sheetContent: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  friendNameText: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  moonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 8,
  },
  moonButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moonEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  moonLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
