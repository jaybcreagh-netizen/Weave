import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface IntentionsFABProps {
  count: number;
  onClick: () => void;
}

/**
 * Floating Action Button for intentions
 * Shows in bottom left of friend profile with shooting star icon
 * Displays count badge if there are intentions
 */
export function IntentionsFAB({ count, onClick }: IntentionsFABProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClick();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.fab,
          { backgroundColor: colors.secondary },
          animatedStyle,
        ]}
      >
        <Sparkles color={colors.foreground} size={26} />
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors['primary-foreground'] }]}>
              {count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
