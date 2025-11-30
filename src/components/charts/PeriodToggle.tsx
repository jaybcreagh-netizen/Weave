/**
 * PeriodToggle
 * Segmented control for selecting time period (Week/Month)
 * iOS-native style with haptic feedback
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

export type Period = 'week' | 'month';

interface PeriodToggleProps {
  value: Period;
  onChange: (period: Period) => void;
}

export const PeriodToggle: React.FC<PeriodToggleProps> = ({
  value,
  onChange,
}) => {
  const { tokens, radius, spacing } = useTheme();

  const slidePosition = useSharedValue(value === 'week' ? 0 : 1);

  React.useEffect(() => {
    slidePosition.value = withTiming(value === 'week' ? 0 : 1, { duration: 200 });
  }, [value]);

  const handlePress = (period: Period) => {
    if (period !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(period);
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slidePosition.value * (containerWidth / 2) }],
  }));

  const containerWidth = 200; // Fixed width for predictable animation

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: tokens.secondary, // Darker background for visibility
        borderRadius: radius.md, // Slightly rounder
        width: containerWidth,
        padding: 4, // More padding
      }
    ]}>
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: tokens.card.background, // White/Dark card bg
            borderRadius: radius.sm,
            width: containerWidth / 2 - 4,
            ...tokens.shadow.sm, // Add shadow
          },
          indicatorStyle,
        ]}
      />

      {/* Week button */}
      <TouchableOpacity
        onPress={() => handlePress('week')}
        style={styles.button}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          {
            color: value === 'week' ? tokens.foreground : tokens.foregroundMuted,
            fontFamily: value === 'week' ? 'Inter_600SemiBold' : 'Inter_500Medium',
          }
        ]}>
          Week
        </Text>
      </TouchableOpacity>

      {/* Month button */}
      <TouchableOpacity
        onPress={() => handlePress('month')}
        style={styles.button}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          {
            color: value === 'month' ? tokens.foreground : tokens.foregroundMuted,
            fontFamily: value === 'month' ? 'Inter_600SemiBold' : 'Inter_500Medium',
          }
        ]}>
          Month
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 2,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  buttonText: {
    fontSize: 14,
  },
});
