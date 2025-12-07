import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Modal, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { type Vibe } from './types';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type InteractionCategory } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

interface MicroReflectionSheetProps {
  isVisible: boolean;
  friendName: string;
  activityLabel: string;
  activityId: string;
  friendArchetype?: string;
  onSave: (data: { vibe?: Vibe; notes?: string; title?: string }) => void;
  onSkip: () => void;
}

import { MoonPhaseSelector } from '@/components/MoonPhaseSelector';

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

  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Auto-dismiss timer removed per user request
  useEffect(() => {
    if (isVisible) {
      // Check if activityLabel looks like a category ID (e.g. "event-party")
      if (activityLabel && activityLabel.includes('-')) {
        const metadata = getCategoryMetadata(activityLabel as InteractionCategory);
        if (metadata && metadata.label) {
          setTitle(metadata.label);
          return;
        }
      }

      setTitle(activityLabel); // Reset title when opening
    }
  }, [isVisible, activityLabel]);

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
        title: title.trim() || activityLabel, // Pass the edited title
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
    setTitle('');
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

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {/* Header */}
                  <View style={styles.header}>
                    <Text style={[styles.activityText, { color: colors['muted-foreground'] }]}>
                      ✨ Logged
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
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </BlurView>
        </Animated.View>
      </View>
    </Modal >
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
    // Container style can remain or be adjusted if needed, currently flex row but Selector is vertical list
    // MoonPhaseSelector handles its own width/layout mainly.
    // Let's reset it to simpler container
    width: '100%',
    marginBottom: 20,
  },
  // Removed unused moonButton, moonEmoji, moonLabel styles
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
