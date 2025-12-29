import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';

interface NudgesFABProps {
  isVisible: boolean;
  hasSuggestions: boolean;
  hasCritical: boolean;
  onClick: () => void;
}

export function NudgesFAB({ isVisible, hasSuggestions, hasCritical, onClick }: NudgesFABProps) {
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
      style={{
        position: 'absolute',
        left: 20,
        bottom: insets.bottom + 20,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
        shadowColor: isDarkMode ? colors.accent : '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 10,
      }}
    >
      <Animated.View style={iconStyle}>
        <WeaveIcon size={24} color={colors.foreground} />
      </Animated.View>
    </TouchableOpacity>
  );
}

