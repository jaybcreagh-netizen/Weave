import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';

interface InsightsFABProps {
  isVisible: boolean;
  hasSuggestions: boolean;
  hasCritical: boolean;
  onClick: () => void;
}

export function InsightsFAB({ isVisible, hasSuggestions, hasCritical, onClick }: InsightsFABProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const pulseScale = useSharedValue(1);

  // Gentle pulse animation
  useEffect(() => {
    if (hasSuggestions) {
      pulseScale.value = withRepeat(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [hasSuggestions]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!isVisible) return null;

  return (
    <TouchableOpacity
      onPress={onClick}
      className="absolute w-16 h-16 rounded-full items-center justify-center z-50 left-6 shadow-lg"
      style={{
        bottom: insets.bottom + 24,
        backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
        shadowColor: isDarkMode ? colors.accent : '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 12,
      }}
    >
      <Animated.View style={iconStyle}>
        <WeaveIcon size={28} color={colors.foreground} />
      </Animated.View>
    </TouchableOpacity>
  );
}
