import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  withTiming,
} from 'react-native-reanimated';

import { getThreadColors } from '../lib/timeline-utils';

interface ParallaxThreadProps {
  warmth: number;
  isFuture: boolean;
  scrollY: Animated.SharedValue<number>;
  itemY: number;
}

export function ParallaxThread({ warmth, isFuture, scrollY, itemY }: ParallaxThreadProps) {
  const colors = getThreadColors(warmth, isFuture);

  // Parallax effect - thread moves at 40% speed (slower than content)
  const animatedStyle = useAnimatedStyle(() => {
    // Calculate parallax offset
    // As user scrolls, thread moves slower, creating depth
    const parallaxFactor = 0.4;
    const offset = scrollY.value * parallaxFactor;
    
    return {
      transform: [
        { translateY: -offset }
      ],
    };
  });

  // Subtle fade based on scroll position
  const fadeStyle = useAnimatedStyle(() => {
    const itemPosition = itemY - scrollY.value;
    
    // Gentle fade at very top (creates softer appearance)
    const topFade = interpolate(
      itemPosition,
      [-100, 0],
      [0.4, 1],
      'clamp'
    );
    
    // Gentle fade at bottom
    const bottomFade = interpolate(
      itemPosition,
      [700, 850],
      [1, 0.4],
      'clamp'
    );
    
    return {
      opacity: Math.min(topFade, bottomFade),
    };
  });

  // Smooth color transitions
  const colorStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(colors.thread, { duration: 400 }),
    };
  });

  return (
    <Animated.View 
      style={[
        styles.thread,
        isFuture && styles.threadDashed,
        colorStyle,
        animatedStyle,
        fadeStyle,
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  thread: {
    position: 'absolute',
    top: 0,
    bottom: -24,
    width: 2,
    left: '50%',
    marginLeft: -1,
  },
  threadDashed: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(181, 138, 108, 0.4)',
  },
});