import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { isFuture, isToday, differenceInDays } from 'date-fns';

import { useTheme } from '../hooks/useTheme';

const AnimatedLine = Animated.createAnimatedComponent(Line);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ThreadSegment {
  startY: number;
  endY: number;
  texture: 'dotted' | 'solid' | 'dashed';
  color: string;
}

interface ContinuousThreadProps {
  contentHeight: number;
  startY?: number;
  interactions?: Array<{
    id: string;
    interactionDate: Date | string;
    y: number; // Position of this interaction in the timeline
  }>;
}

/**
 * Continuous background thread that runs through entire timeline
 * Thread texture changes based on time: dotted (future), solid (today/recent), dashed (past)
 * Transitions occur at knot positions
 */
export function ContinuousThread({ contentHeight, startY = 0, interactions = [] }: ContinuousThreadProps) {
  const { colors, isDarkMode } = useTheme();
  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    // Animate the height to "draw" the line down
    animatedHeight.value = withTiming(contentHeight, {
      duration: 600, 
      easing: Easing.out(Easing.quad)
    });
  }, [contentHeight]);

  const animatedSvgStyle = useAnimatedStyle(() => {
    return {
      height: animatedHeight.value,
    };
  });
  // Determine texture based on interaction date
  const getThreadTexture = (date: Date | string): 'dotted' | 'solid' | 'dashed' => {
    const interactionDate = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    if (isFuture(interactionDate)) {
      return 'dotted'; // Future plans
    } else if (isToday(interactionDate)) {
      return 'solid'; // Today
    } else {
      const daysAgo = differenceInDays(today, interactionDate);
      if (daysAgo <= 3) {
        return 'solid'; // Recent (within 3 days)
      } else {
        return 'dashed'; // Past memories
      }
    }
  };

  // Get color based on texture type and position (gradient effect)
  const getThreadColor = (texture: 'dotted' | 'solid' | 'dashed', yPosition: number): string => {
    if (!isDarkMode) {
      // Original light mode gradient
      const gradientPosition = contentHeight > 0 ? yPosition / contentHeight : 0;
      const baseOpacity = texture === 'dotted' ? 0.5 : texture === 'solid' ? 0.8 : 0.7;
      if (gradientPosition < 0.2) return `rgba(212, 175, 55, ${baseOpacity})`;
      if (gradientPosition < 0.5) return `rgba(181, 138, 108, ${baseOpacity})`;
      return `rgba(181, 138, 108, ${baseOpacity * 0.8})`;
    }

    // New Dark Mode "Mystic Arcane" Gradient
    const gradientPosition = contentHeight > 0 ? yPosition / contentHeight : 0;
    const opacity = texture === 'dotted' ? 0.4 : texture === 'solid' ? 0.9 : 0.6;

    // Interpolate between accent (top) and a deep purple (bottom)
    const r = Math.round(139 - (139 - 68) * gradientPosition);
    const g = Math.round(92 - (92 - 51) * gradientPosition);
    const b = Math.round(246 - (246 - 128) * gradientPosition);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Build thread segments between knots
  const segments: ThreadSegment[] = [];

  if (interactions.length > 0) {
    // Filter out items with no position yet
    const positioned = interactions.filter(i => i.y > 0);

    // If no items have positions yet, create segments based on date order
    // This provides immediate visual feedback before layout completes
    if (positioned.length === 0) {
      // Sort by date (newest to oldest)
      const sortedByDate = [...interactions].sort((a, b) => {
        const dateA = typeof a.interactionDate === 'string' ? new Date(a.interactionDate) : a.interactionDate;
        const dateB = typeof b.interactionDate === 'string' ? new Date(b.interactionDate) : b.interactionDate;
        return dateB.getTime() - dateA.getTime();
      });

      // Estimate positions evenly distributed
      const itemHeight = 150; // Approximate height per item
      sortedByDate.forEach((interaction, i) => {
        const estimatedY = i * itemHeight;
        const nextEstimatedY = (i + 1) * itemHeight;
        const texture = getThreadTexture(interaction.interactionDate);
        const color = getThreadColor(texture, estimatedY);

        segments.push({
          startY: estimatedY,
          endY: i === sortedByDate.length - 1 ? contentHeight : nextEstimatedY,
          texture,
          color,
        });
      });
    } else {
      // Use actual positions
      const sortedByPosition = [...positioned].sort((a, b) => a.y - b.y);

      if (sortedByPosition.length === 1) {
        const interaction = sortedByPosition[0];
        const texture = getThreadTexture(interaction.interactionDate);
        const color = getThreadColor(texture, interaction.y);

        segments.push({
          startY: 0,
          endY: contentHeight,
          texture,
          color,
        });
      } else {
        // Create segments between consecutive knots
        for (let i = 0; i < sortedByPosition.length - 1; i++) {
          const currentInteraction = sortedByPosition[i];
          const nextInteraction = sortedByPosition[i + 1];

          // The segment's texture is determined by the knot it came from (current)
          // Texture changes only when passing through a knot
          const texture = getThreadTexture(currentInteraction.interactionDate);
          const segmentMidpoint = currentInteraction.y + ((nextInteraction.y - currentInteraction.y) / 2);
          const color = getThreadColor(texture, segmentMidpoint);

          segments.push({
            startY: currentInteraction.y,
            endY: nextInteraction.y,
            texture,
            color,
          });
        }

        // Add segment from last knot to bottom
        const lastInteraction = sortedByPosition[sortedByPosition.length - 1];
        const lastTexture = getThreadTexture(lastInteraction.interactionDate);
        const lastColor = getThreadColor(lastTexture, lastInteraction.y);

        segments.push({
          startY: lastInteraction.y,
          endY: contentHeight,
          texture: lastTexture,
          color: lastColor,
        });
      }
    }
  }

  // Render thread segment with appropriate texture
  const renderSegment = (segment: ThreadSegment, index: number) => {
    const x = 2; // Center of the 4px wide container
    const strokeDasharray = segment.texture === 'dotted'
      ? '2 6' // Small dots with gaps
      : segment.texture === 'dashed'
      ? '8 4' // Dashes
      : undefined; // Solid (no dash array)

    return (
      <AnimatedLine
        key={`segment-${index}`}
        x1={x}
        y1={segment.startY}
        x2={x}
        y2={segment.endY}
        stroke={segment.color}
        strokeWidth={1.5}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
      />
    );
  };

  // Debug logging removed for performance

  // Fallback: if no segments, render a simple solid line
  if (segments.length === 0 && contentHeight > 0) {
    return (
      <View
        style={[
          styles.container,
          {
            height: contentHeight,
            top: startY,
          },
        ]}
        pointerEvents="none"
      >
        <Animated.View style={animatedSvgStyle}>
          <Svg width={4} height={contentHeight} style={StyleSheet.absoluteFill}>
            <Line
              x1={2}
              y1={0}
              x2={2}
              y2={contentHeight}
              stroke="rgba(181, 138, 108, 0.6)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          height: contentHeight,
          top: startY,
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.svgContainer, animatedSvgStyle]}>
        <Svg width={4} height={contentHeight} style={StyleSheet.absoluteFill}>
          {segments.map((segment, index) => renderSegment(segment, index))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Positioning: Align with knot markers
    // dateColumn: 72px + gap: 16px + half knotContainer: 10px = 98px
    left: 98,
    width: 4,
    top: 0, // Dynamic, set via style prop
    zIndex: -1, // Behind everything
  },
  svgContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  threadCore: {
    position: 'absolute',
    width: 1,
    height: '100%',
    left: 0,
  },
  ropeStrand: {
    position: 'absolute',
    width: 1,
    height: '100%',
    opacity: 0.6,
  },
  gradient: {
    flex: 1,
    width: '100%',
  },
});