import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Milestone } from '../lib/milestone-tracker';

/**
 * Thread Progress Bar
 *
 * A beautiful, organic animation showing progress toward the next milestone.
 * Not a harsh progress bar, but a thread gradually weaving through nodes.
 *
 * Design philosophy:
 * - Organic, flowing motion (not rigid/geometric)
 * - Thread "breathes" with gentle pulsing
 * - Approaching milestone: glow intensifies
 * - Milestone achieved: celebration burst
 */

interface ThreadProgressBarProps {
  currentValue: number; // e.g., current streak: 12
  nextMilestone: Milestone | null; // e.g., { id: 'consistent-weaver', threshold: 21 }
  currentMilestone: Milestone | null; // e.g., { id: 'thread-starter', threshold: 7 }
}

export const ThreadProgressBar: React.FC<ThreadProgressBarProps> = ({
  currentValue,
  nextMilestone,
  currentMilestone,
}) => {
  const { colors } = useTheme();

  // Calculate progress percentage
  const startValue = currentMilestone?.threshold || 0;
  const endValue = nextMilestone?.threshold || currentValue;
  const range = endValue - startValue;
  const progress = range > 0 ? Math.min((currentValue - startValue) / range, 1) : 1;

  // Animated values
  const glowOpacity = useSharedValue(0.4);
  const pulseScale = useSharedValue(1);

  // Breathing animation for the thread
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite
      false
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // If no next milestone, show completion state
  if (!nextMilestone) {
    return (
      <View className="py-4">
        <View className="flex-row items-center justify-center">
          <Text
            className="font-inter-medium text-sm"
            style={{ color: colors['muted-foreground'] }}
          >
            All milestones achieved! 🌟
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-3">
      {/* Progress Track */}
      <View className="relative h-2 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: colors.border }}
      >
        {/* Filled Progress - Animated Gradient Thread */}
        <Animated.View
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={[
            {
              width: `${progress * 100}%`,
              backgroundColor: colors.primary,
            },
            pulseStyle,
          ]}
        >
          {/* Glowing Edge Effect */}
          <Animated.View
            className="absolute right-0 top-0 bottom-0 w-6 rounded-full"
            style={[
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 6,
                elevation: 8,
              },
              glowStyle,
            ]}
          />
        </Animated.View>
      </View>

      {/* Milestone Labels */}
      <View className="flex-row items-center justify-between">
        {/* Current Milestone */}
        {currentMilestone && (
          <View className="flex-row items-center gap-1">
            <Text className="text-sm">{currentMilestone.icon}</Text>
            <Text
              className="font-inter-medium text-xs"
              style={{ color: colors['muted-foreground'] }}
            >
              {currentMilestone.name}
            </Text>
          </View>
        )}

        {/* Progress Counter */}
        <Text
          className="font-inter-semibold text-xs"
          style={{ color: colors.primary }}
        >
          {currentValue}/{nextMilestone.threshold}
        </Text>

        {/* Next Milestone */}
        <View className="flex-row items-center gap-1">
          <Text className="text-sm">{nextMilestone.icon}</Text>
          <Text
            className="font-inter-medium text-xs"
            style={{ color: colors['muted-foreground'] }}
          >
            {nextMilestone.name}
          </Text>
        </View>
      </View>

      {/* Next Milestone Label */}
      <View className="mt-2 items-center">
        <Text
          className="font-inter-regular text-xs text-center"
          style={{ color: colors['muted-foreground'] }}
        >
          {nextMilestone.threshold - currentValue === 1
            ? '1 day until'
            : `${nextMilestone.threshold - currentValue} days until`}{' '}
          <Text className="font-inter-semibold">{nextMilestone.name}</Text>
        </Text>
      </View>
    </View>
  );
};
