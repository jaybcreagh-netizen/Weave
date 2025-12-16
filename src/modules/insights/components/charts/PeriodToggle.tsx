/**
 * PeriodToggle
 * Segmented control for selecting time period (Week/Month)
 * iOS-native style with haptic feedback
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
  const { tokens } = useTheme();

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

  const containerWidth = 200; // Fixed width for predictable animation

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slidePosition.value * (containerWidth / 2) }],
  }));

  return (
    <View
      className="flex-row relative p-1 rounded-lg w-[200px]"
      style={{
        backgroundColor: tokens.secondary,
      }}
    >
      {/* Sliding indicator */}
      <Animated.View
        className="absolute top-0.5 left-0.5 bottom-0.5 rounded shadow-sm"
        style={[
          {
            backgroundColor: tokens.card.background,
            width: containerWidth / 2 - 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          },
          indicatorStyle,
        ]}
      />

      {/* Week button */}
      <TouchableOpacity
        onPress={() => handlePress('week')}
        className="flex-1 py-2 items-center justify-center z-10"
        activeOpacity={0.7}
      >
        <Text
          className="text-sm"
          style={{
            color: value === 'week' ? tokens.foreground : tokens.foregroundMuted,
            fontFamily: value === 'week' ? 'Inter_600SemiBold' : 'Inter_500Medium',
          }}
        >
          Week
        </Text>
      </TouchableOpacity>

      {/* Month button */}
      <TouchableOpacity
        onPress={() => handlePress('month')}
        className="flex-1 py-2 items-center justify-center z-10"
        activeOpacity={0.7}
      >
        <Text
          className="text-sm"
          style={{
            color: value === 'month' ? tokens.foreground : tokens.foregroundMuted,
            fontFamily: value === 'month' ? 'Inter_600SemiBold' : 'Inter_500Medium',
          }}
        >
          Month
        </Text>
      </TouchableOpacity>
    </View>
  );
};
