import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../theme';

interface SectionHeaderProps {
  title: string;
  index: number;
  isFirst?: boolean;
}

export function SectionHeader({ title, index, isFirst = false }: SectionHeaderProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-15);

  useEffect(() => {
    // Stagger slightly before first card in each section
    const delay = 150 + (index * 120); // Sync with card stagger

    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.quad)
      })
    );

    translateX.value = withDelay(
      delay,
      withSpring(0, {
        damping: 20,
        stiffness: 100,
      })
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  // Decorative accent based on section
  const getAccentColor = (title: string) => {
    if (title.includes('Seeds')) return 'rgba(181, 138, 108, 0.4)'; // Future - light
    if (title.includes('Today')) return 'rgba(212, 175, 55, 0.8)'; // Today - golden
    return 'rgba(181, 138, 108, 0.6)'; // Past - medium
  };

  const accentColor = getAccentColor(title);

  return (
    <View style={styles.container}>
      {/* Gradient divider (not for first section) */}
      {!isFirst && (
        <View style={styles.dividerContainer}>
          <LinearGradient
            colors={[
              'rgba(181, 138, 108, 0.08)',
              'rgba(181, 138, 108, 0.15)',
              'rgba(181, 138, 108, 0.08)',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientLine}
          />
        </View>
      )}

      {/* Section title */}
      <View style={styles.headerContainer}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <Animated.View style={animatedStyle}>
          <Text style={styles.headerText}>{title}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
  },
  dividerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  gradientLine: {
    height: 1,
    width: '100%',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 98, // Matches continuous thread left position (72 + 16 + 10)
    paddingRight: 20,
    gap: 12,
  },
  accent: {
    width: 2, // More subtle than thread
    height: 14,
    borderRadius: 1,
    opacity: 0.6,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors['muted-foreground'],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});