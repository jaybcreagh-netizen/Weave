import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface SimpleTutorialTooltipProps {
  visible: boolean;
  title: string;
  description: string;
  onNext?: () => void;
  onSkip?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

/**
 * SimpleTutorialTooltip - A non-intrusive bottom tooltip for tutorials
 * No spotlight, no blocking, just helpful guidance
 */
export function SimpleTutorialTooltip({
  visible,
  title,
  description,
  onNext,
  onSkip,
  currentStep,
  totalSteps,
}: SimpleTutorialTooltipProps) {
  const { colors } = useTheme();

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext?.();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip?.();
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      exiting={FadeOutDown.duration(200)}
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Progress indicator */}
      {currentStep !== undefined && totalSteps !== undefined && (
        <View style={styles.progressContainer}>
          <Text style={[styles.progressText, { color: colors['muted-foreground'] }]}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
      )}

      {/* Content */}
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors['muted-foreground'] }]}>
        {description}
      </Text>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {onSkip && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipButtonText, { color: colors['muted-foreground'] }]}>
              Skip
            </Text>
          </TouchableOpacity>
        )}

        {onNext && (
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.nextButtonText}>Got it</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999, // Ensure tooltip appears above all other elements (FAB, buttons, etc.)
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
