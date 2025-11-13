import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { WeaveIcon } from './WeaveIcon';

interface InsightsFABProps {
  hasSuggestions: boolean;
  hasCritical: boolean;
  onClick: () => void;
}

export function InsightsFAB({ hasSuggestions, hasCritical, onClick }: InsightsFABProps) {
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

  if (!hasSuggestions) return null; // Don't show FAB if no suggestions

  // Match the styling of the main + FAB
  const fabStyle = {
    ...styles.container,
    bottom: insets.bottom + 24,
    backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
    shadowColor: isDarkMode ? colors.accent : '#000',
  };

  return (
    <TouchableOpacity onPress={onClick} style={fabStyle}>
      <Animated.View style={iconStyle}>
        <WeaveIcon size={28} color={colors.foreground} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    left: 24, // Opposite side from add friend FAB
  },
  icon: {
    fontSize: 28,
  },
});
