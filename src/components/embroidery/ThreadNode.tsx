import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Easing,
  withTiming,
} from 'react-native-reanimated';
import { Rect, G } from 'react-native-svg';
import { formatPoeticDate } from '../../lib/timeline-utils';
import { getKnotDimensions, getCardDimensions, calculateNodeWarmth, type NodeSize } from '../../lib/embroidery-utils';
import { modeIcons } from '../../lib/constants';
import { theme } from '../../theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

interface ThreadNodeProps {
  x: number; // Knot position (on thread)
  y: number;
  cardX: number; // Card position (off thread)
  cardY: number;
  size: NodeSize;
  interaction: any;
  scrollY: Animated.SharedValue<number>;
  screenHeight: number;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * Individual interaction node on the embroidery timeline
 * Three variants: small (quick touch), medium (standard), large (deep weave)
 */
export function ThreadNode({
  x,
  y,
  cardX,
  cardY,
  size,
  interaction,
  scrollY,
  screenHeight,
  onPress,
  onLongPress,
}: ThreadNodeProps) {
  const knotDims = getKnotDimensions();
  const cardDims = getCardDimensions(size);
  const ageInDays = Math.floor((Date.now() - new Date(interaction.interactionDate).getTime()) / 86400000);
  const warmth = calculateNodeWarmth(ageInDays);

  const opacity = useSharedValue(0);

  // Colors based on warmth
  const getColor = () => {
    if (warmth > 0.7) return '#D4AF37'; // Golden for recent
    if (warmth > 0.4) return 'rgba(181, 138, 108, 0.9)'; // Warm brown
    return 'rgba(181, 138, 108, 0.6)'; // Faded brown
  };

  // Simple fade-in animation based on scroll position
  const revealStyle = useAnimatedStyle(() => {
    const visibleBottom = scrollY.value + screenHeight;
    const progress = interpolate(
      visibleBottom,
      [y - 100, y + 50],
      [0, 1],
      'clamp'
    );

    opacity.value = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });

    return {
      opacity: opacity.value,
    };
  });

  return (
    <AnimatedG style={revealStyle}>
      {/* Small knot ON the thread */}
      <AnimatedRect
        x={x - knotDims.width / 2}
        y={y - knotDims.height / 2}
        width={knotDims.width}
        height={knotDims.height}
        rx={knotDims.radius}
        ry={knotDims.radius}
        fill={getColor()}
        stroke="rgba(247, 245, 242, 0.9)"
        strokeWidth={1}
      />

      {/* Card OFF the thread (inside curve) */}
      <AnimatedRect
        x={cardX - cardDims.width / 2}
        y={cardY - cardDims.height / 2}
        width={cardDims.width}
        height={cardDims.height}
        rx={cardDims.radius}
        ry={cardDims.radius}
        fill={getColor()}
        stroke="rgba(247, 245, 242, 0.9)"
        strokeWidth={1.5}
        onPress={onPress}
        onLongPress={onLongPress}
      />

      {/* Connector line from knot to card */}
      <AnimatedRect
        x={Math.min(x, cardX)}
        y={y - 0.5}
        width={Math.abs(cardX - x)}
        height={1}
        fill="rgba(181, 138, 108, 0.3)"
      />
    </AnimatedG>
  );
}

/**
 * Label component that appears next to nodes
 * Rendered outside SVG as regular React Native views
 */
export function ThreadNodeLabel({
  x,
  y,
  size,
  interaction,
  onPress,
}: {
  x: number;
  y: number;
  size: NodeSize;
  interaction: any;
  onPress: () => void;
}) {
  const modeIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;
  const { primary: dateText } = formatPoeticDate(interaction.interactionDate);

  // Position label based on node size and side
  const isLeftSide = x < 200; // Assuming center is ~200
  const labelX = isLeftSide ? x + 30 : x - 120;

  if (size === 'small') {
    // Small nodes: just icon and date
    return (
      <View style={[styles.smallLabel, { left: labelX, top: y - 10 }]}>
        <Text style={styles.smallIcon}>{modeIcon}</Text>
        <Text style={styles.smallDate}>{dateText}</Text>
      </View>
    );
  }

  if (size === 'medium') {
    // Medium nodes: icon, activity, date
    return (
      <TouchableOpacity
        style={[styles.mediumLabel, { left: labelX, top: y - 20 }]}
        onPress={onPress}
      >
        <Text style={styles.mediumIcon}>{modeIcon}</Text>
        <View>
          <Text style={styles.mediumActivity}>{interaction.activity}</Text>
          <Text style={styles.mediumDate}>{dateText}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Large nodes: expanded card (will be replaced by NodeDetailCard)
  return (
    <TouchableOpacity
      style={[styles.largeCard, { left: labelX, top: y - 40 }]}
      onPress={onPress}
    >
      <Text style={styles.largeIcon}>{modeIcon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.largeActivity}>{interaction.activity}</Text>
        <Text style={styles.largeDate}>{dateText}</Text>
        {interaction.note && (
          <Text style={styles.largeNote} numberOfLines={2}>
            {interaction.note}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  smallLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallIcon: {
    fontSize: 16,
  },
  smallDate: {
    fontSize: 10,
    color: theme.colors['muted-foreground'],
  },
  mediumLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mediumIcon: {
    fontSize: 22,
  },
  mediumActivity: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.foreground,
    fontFamily: 'Lora_700Bold',
  },
  mediumDate: {
    fontSize: 11,
    color: theme.colors['muted-foreground'],
  },
  largeCard: {
    position: 'absolute',
    width: 200,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  largeIcon: {
    fontSize: 32,
  },
  largeActivity: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
    fontFamily: 'Lora_700Bold',
    marginBottom: 4,
  },
  largeDate: {
    fontSize: 12,
    color: theme.colors['muted-foreground'],
    marginBottom: 6,
  },
  largeNote: {
    fontSize: 12,
    color: theme.colors.foreground,
    lineHeight: 16,
  },
});
