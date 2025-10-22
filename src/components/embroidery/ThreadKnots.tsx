import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { calculateWeaveWarmth, getThreadColors } from '../../lib/timeline-utils';
import type { Interaction } from '../types';

interface ThreadKnotsProps {
  interactions: Interaction[];
  itemPositions: {[key: string]: number};
  scrollY: Animated.SharedValue<number>;
  screenHeight: number;
}

/**
 * Renders knots on the continuous thread with connector lines to cards
 */
export function ThreadKnots({ interactions, itemPositions, scrollY, screenHeight }: ThreadKnotsProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      {interactions.map((interaction) => {
        const itemY = itemPositions[interaction.id];
        if (!itemY) return null;

        const date = typeof interaction.interactionDate === 'string'
          ? new Date(interaction.interactionDate)
          : interaction.interactionDate;
        const warmth = calculateWeaveWarmth(date);
        const colors = getThreadColors(warmth, false);

        return (
          <ThreadKnot
            key={interaction.id}
            y={itemY}
            warmth={warmth}
            colors={colors}
            scrollY={scrollY}
            screenHeight={screenHeight}
          />
        );
      })}
    </View>
  );
}

interface ThreadKnotProps {
  y: number;
  warmth: number;
  colors: any;
  scrollY: Animated.SharedValue<number>;
  screenHeight: number;
}

function ThreadKnot({ y, warmth, colors, scrollY, screenHeight }: ThreadKnotProps) {
  // Fade in animation based on scroll
  const animatedStyle = useAnimatedStyle(() => {
    const visibleBottom = scrollY.value + screenHeight;
    const progress = interpolate(
      visibleBottom,
      [y - 100, y + 50],
      [0, 1],
      'clamp'
    );

    const opacity = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });

    return { opacity };
  });

  const THREAD_LEFT = 98; // Matches ContinuousThread left position
  const CARD_START = 20 + 72 + 16 + 20; // padding + dateColumn + gap + knotContainer

  return (
    <Animated.View style={[styles.knotWrapper, { top: y + 20 }, animatedStyle]}>
      {/* Connector line from thread to card */}
      <View style={[styles.connectorLine, { left: THREAD_LEFT, width: CARD_START - THREAD_LEFT }]} />

      {/* Knot on the thread */}
      <View
        style={[
          styles.knot,
          {
            left: THREAD_LEFT - 7, // Center on thread (knot width 14 / 2)
            backgroundColor: colors.knot,
            shadowColor: warmth > 0.5 ? '#D4AF37' : '#000',
            shadowRadius: 4 + (warmth * 8),
          }
        ]}
      >
        {/* Glow for warm knots */}
        {warmth > 0.5 && (
          <View style={[styles.knotGlow, { backgroundColor: colors.glow }]} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, // Above thread, below cards
  },
  knotWrapper: {
    position: 'absolute',
    width: '100%',
    height: 40,
    left: 0,
  },
  connectorLine: {
    position: 'absolute',
    height: 1,
    top: 20,
    backgroundColor: 'rgba(181, 138, 108, 0.3)',
  },
  knot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: 13, // Center vertically in wrapper
    borderWidth: 2,
    borderColor: 'rgba(247, 245, 242, 0.8)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 4,
  },
  knotGlow: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: -7,
    left: -7,
    zIndex: -1,
  },
});
