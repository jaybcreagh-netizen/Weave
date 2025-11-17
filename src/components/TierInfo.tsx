import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

interface TierInfoProps {
  activeTier: 'inner' | 'close' | 'community';
}

const TIER_INFO = {
  inner: {
    size: '~5 closest bonds',
    essence: 'Fast decay • Highest attention',
  },
  close: {
    size: '~15 important relationships',
    essence: 'Moderate decay • Regular care',
  },
  community: {
    size: '~50 meaningful connections',
    essence: 'Slow decay • Gentle touch',
  },
};

export function TierInfo({ activeTier }: TierInfoProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Subtle fade animation when tier changes
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [activeTier]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const info = TIER_INFO[activeTier];

  return (
    <Animated.View
      className="px-4 pb-2 pt-1"
      style={animatedStyle}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-xs font-medium"
          style={{ color: colors['muted-foreground'], opacity: 0.8 }}
        >
          {info.size}
        </Text>
        <Text
          className="text-xs"
          style={{ color: colors['muted-foreground'], opacity: 0.6 }}
        >
          {info.essence}
        </Text>
      </View>
    </Animated.View>
  );
}
