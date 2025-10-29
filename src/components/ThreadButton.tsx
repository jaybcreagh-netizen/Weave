import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface ThreadButtonProps {
  count: number;
  hasCritical: boolean;
  onPress: () => void;
}

export function ThreadButton({ count, hasCritical, onPress }: ThreadButtonProps) {
  const { colors } = useTheme();
  const pulseScale = useSharedValue(1);

  // Pulse animation for critical suggestions
  useEffect(() => {
    if (hasCritical) {
      pulseScale.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [hasCritical]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.icon}>🧵</Text>
      {count > 0 && (
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: hasCritical ? colors.destructive : colors.accent },
            badgeStyle,
          ]}
        >
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
