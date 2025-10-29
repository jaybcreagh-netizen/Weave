import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { getCategoryMetadata } from '../lib/interaction-categories';
import Intention from '../db/models/Intention';
import { InteractionCategory } from './types';

interface IntentionMiniCardProps {
  intention: Intention;
  onPress: () => void;
  index: number;
}

/**
 * Small circular intention indicator for friend profile timeline
 * Appears in Seeds section, no connecting line to thread
 */
export function IntentionMiniCard({ intention, onPress, index }: IntentionMiniCardProps) {
  const { colors, isDarkMode } = useTheme();
  const pressScale = useSharedValue(1);

  const category = intention.interactionCategory
    ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
    : null;

  const handlePressIn = () => {
    pressScale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.circle,
            {
              backgroundColor: isDarkMode ? colors.secondary : colors.muted,
              borderColor: colors.border,
            },
            animatedStyle,
          ]}
        >
          <Text style={styles.icon}>
            {category ? category.icon : '🌱'}
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {intention.description && (
        <View style={[styles.labelContainer, { backgroundColor: isDarkMode ? colors.card : colors.background }]}>
          <Text
            style={[styles.label, { color: colors.foreground }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {intention.description}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 28,
  },
  labelContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: 200,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
