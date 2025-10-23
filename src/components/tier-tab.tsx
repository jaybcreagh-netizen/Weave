// src/components/tier-tab.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface TierTabProps {
  label: string;
  shortLabel?: string;
  count?: number;
  maxCount?: number;
  isActive: boolean;
  onClick: () => void;
  tier: 'inner' | 'close' | 'community';
}

const tierIcons = {
  inner: "⭐",
  close: "💫",
  community: "🌐"
};

export function TierTab({ shortLabel, label, count, maxCount, isActive, onClick, tier }: TierTabProps) {
  const { colors } = useTheme(); // Use the hook
  const tierColor = colors.tier[tier];
  const tierIcon = tierIcons[tier];

  // Animate background color and text color for a smooth transition
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(isActive ? colors.primary + '33' : 'transparent', { duration: 250 }),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: withTiming(isActive ? 0.15 : 0, { duration: 250 }),
      shadowRadius: withTiming(isActive ? 5 : 0, { duration: 250 }),
      elevation: withTiming(isActive ? 4 : 0, { duration: 250 }),
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(isActive ? colors.foreground : colors['muted-foreground'], { duration: 250 }),
    };
  });

  const animatedCountTextStyle = useAnimatedStyle(() => {
    return {
        color: withTiming(isActive ? colors.foreground : colors['muted-foreground'], { duration: 250 }),
    }
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClick();
      }}
      style={({ pressed }) => [styles.pressable, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        {/* Unified Accent Dot */}
        {!isActive && (
          <View style={[styles.accentDot, { backgroundColor: tierColor }]} />
        )}

        <Text style={styles.icon}>{tierIcon}</Text>
        
        <Animated.Text style={[styles.label, animatedTextStyle]}>
          {shortLabel || label}
        </Animated.Text>
        
        {count !== undefined && (
          <Animated.Text style={[styles.count, animatedCountTextStyle]}>
            {count}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
    pressable: {
        flex: 1, // Let the pressable area grow, but the content inside dictates the width.
        minWidth: 80, // Prevent tabs from becoming too small on large screens
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden', // Ensures rounded corners clip child elements
    },
    accentDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    icon: {
        fontSize: 16,
    },
    label: {
        fontWeight: '600',
        fontSize: 14,
    },
    count: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: -2, // Optical adjustment to bring count closer to label
    },
});