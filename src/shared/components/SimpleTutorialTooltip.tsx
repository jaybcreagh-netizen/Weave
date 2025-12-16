import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
      className="absolute bottom-5 left-5 right-5 rounded-2xl p-5 border z-[9999]"
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      {/* Progress indicator */}
      {currentStep !== undefined && totalSteps !== undefined && (
        <View className="mb-2">
          <Text
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: colors['muted-foreground'] }}
          >
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
      )}

      {/* Content */}
      <Text
        className="text-lg font-bold font-lora-bold mb-2"
        style={{ color: colors.foreground }}
      >
        {title}
      </Text>
      <Text
        className="text-sm leading-5 mb-4"
        style={{ color: colors['muted-foreground'] }}
      >
        {description}
      </Text>

      {/* Actions */}
      <View className="flex-row justify-end items-center gap-3">
        {onSkip && (
          <TouchableOpacity onPress={handleSkip} className="p-2">
            <Text
              className="text-sm font-medium"
              style={{ color: colors['muted-foreground'] }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        )}

        {onNext && (
          <TouchableOpacity
            onPress={handleNext}
            className="py-2.5 px-5 rounded-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white text-sm font-semibold">Got it</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

