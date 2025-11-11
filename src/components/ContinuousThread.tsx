import React, { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
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

  // Thread boundary padding
  const THREAD_TOP_PADDING = 30; // Padding above first knot
  const THREAD_BOTTOM_PADDING = 30; // Padding below last knot
  const MIN_THREAD_LENGTH = 100; // Minimum visible thread for single weave

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
  // Determine texture based on interaction date - temporal fading
  // Recent solid → Past dashed → Old dotted
  const getThreadTexture = (date: Date | string): 'dotted' | 'solid' | 'dashed' => {
    const interactionDate = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    if (isFuture(interactionDate)) {
      return 'dotted'; // Future plans (hollow knots)
    } else if (isToday(interactionDate)) {
      return 'solid'; // Today
    } else {
      const daysAgo = differenceInDays(today, interactionDate);
      if (daysAgo <= 7) {
        return 'solid'; // Recent past (within a week)
      } else if (daysAgo <= 30) {
        return 'dashed'; // Medium past (within a month)
      } else {
        return 'dotted'; // Old past (over a month) - fades like distant memories
      }
    }
  };

  // Get color based on texture type and position (gradient effect)
  // Opacity fades with time: solid (bold) → dashed (medium) → dotted (faint)
  const getThreadColor = (texture: 'dotted' | 'solid' | 'dashed', yPosition: number): string => {
    if (!isDarkMode) {
      // Light mode gradient with temporal fading
      const gradientPosition = contentHeight > 0 ? yPosition / contentHeight : 0;
      const baseOpacity = texture === 'solid' ? 0.8 : texture === 'dashed' ? 0.6 : 0.35; // More fade for old
      if (gradientPosition < 0.2) return `rgba(212, 175, 55, ${baseOpacity})`;
      if (gradientPosition < 0.5) return `rgba(181, 138, 108, ${baseOpacity})`;
      return `rgba(181, 138, 108, ${baseOpacity * 0.85})`;
    }

    // Dark Mode "Mystic Arcane" Gradient with temporal fading
    const gradientPosition = contentHeight > 0 ? yPosition / contentHeight : 0;
    const opacity = texture === 'solid' ? 0.9 : texture === 'dashed' ? 0.65 : 0.35; // More fade for old

    // Interpolate between accent (top) and a deep purple (bottom)
    const r = Math.round(139 - (139 - 68) * gradientPosition);
    const g = Math.round(92 - (92 - 51) * gradientPosition);
    const b = Math.round(246 - (246 - 128) * gradientPosition);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Build thread segments between knots with bounded boundaries
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
      const firstEstimatedY = Math.max(0, THREAD_TOP_PADDING);
      const lastEstimatedY = sortedByDate.length * itemHeight;

      sortedByDate.forEach((interaction, i) => {
        const estimatedY = i * itemHeight;
        const nextEstimatedY = (i + 1) * itemHeight;
        const texture = getThreadTexture(interaction.interactionDate);
        const color = getThreadColor(texture, estimatedY);

        segments.push({
          startY: i === 0 ? firstEstimatedY : estimatedY,
          endY: i === sortedByDate.length - 1 ? lastEstimatedY + THREAD_BOTTOM_PADDING : nextEstimatedY,
          texture,
          color,
        });
      });
    } else {
      // Use actual positions
      const sortedByPosition = [...positioned].sort((a, b) => a.y - b.y);

      if (sortedByPosition.length === 1) {
        // Single weave: Create bounded thread with minimum length
        const interaction = sortedByPosition[0];
        const texture = getThreadTexture(interaction.interactionDate);
        const knotY = interaction.y;

        // Calculate thread bounds
        const threadStart = Math.max(0, knotY - THREAD_TOP_PADDING);
        const threadEnd = knotY + THREAD_BOTTOM_PADDING;
        const threadLength = threadEnd - threadStart;

        // Ensure minimum thread length for visibility
        const finalThreadStart = threadLength < MIN_THREAD_LENGTH
          ? Math.max(0, knotY - (MIN_THREAD_LENGTH / 2))
          : threadStart;
        const finalThreadEnd = threadLength < MIN_THREAD_LENGTH
          ? knotY + (MIN_THREAD_LENGTH / 2)
          : threadEnd;

        const color = getThreadColor(texture, knotY);

        segments.push({
          startY: finalThreadStart,
          endY: finalThreadEnd,
          texture,
          color,
        });
      } else {
        // Multiple weaves: Bounded by first and last knot positions
        const firstKnot = sortedByPosition[0];
        const lastKnot = sortedByPosition[sortedByPosition.length - 1];

        // Add initial segment from top padding to first knot
        const firstTexture = getThreadTexture(firstKnot.interactionDate);
        const firstColor = getThreadColor(firstTexture, firstKnot.y);
        segments.push({
          startY: Math.max(0, firstKnot.y - THREAD_TOP_PADDING),
          endY: firstKnot.y,
          texture: firstTexture,
          color: firstColor,
        });

        // Create segments between consecutive knots
        for (let i = 0; i < sortedByPosition.length - 1; i++) {
          const currentInteraction = sortedByPosition[i];
          const nextInteraction = sortedByPosition[i + 1];

          // The segment's texture is determined by the knot it came from (current)
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

        // Add final segment from last knot to bottom padding
        const lastTexture = getThreadTexture(lastKnot.interactionDate);
        const lastColor = getThreadColor(lastTexture, lastKnot.y);
        segments.push({
          startY: lastKnot.y,
          endY: lastKnot.y + THREAD_BOTTOM_PADDING,
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

  // Calculate actual thread height and position based on segments
  const threadStart = segments.length > 0 ? Math.min(...segments.map(s => s.startY)) : 0;
  const threadEnd = segments.length > 0 ? Math.max(...segments.map(s => s.endY)) : contentHeight;
  const threadHeight = threadEnd - threadStart;

  // Fallback: if no segments, don't render anything (no weaves yet)
  if (segments.length === 0) {
    return null;
  }

  // Adjust segment positions to be relative to thread container
  const adjustedSegments = segments.map(seg => ({
    ...seg,
    startY: seg.startY - threadStart,
    endY: seg.endY - threadStart,
  }));

  return (
    <View
      className="absolute left-[98px] w-1 -z-10"
      style={{
        height: threadHeight,
        top: threadStart,
      }}
      pointerEvents="none"
    >
      <Animated.View className="w-full overflow-hidden" style={animatedSvgStyle}>
        <Svg width={4} height={threadHeight} className="absolute inset-0">
          {adjustedSegments.map((segment, index) => renderSegment(segment, index))}
        </Svg>
      </Animated.View>
    </View>
  );
}

// NativeWind classes used:
// - absolute left-[98px] w-1 -z-10: Container positioning (left: 98px aligns with knot markers)
//   dateColumn: 72px + gap: 16px + half knotContainer: 10px = 98px
// - w-full overflow-hidden: SVG container
// - absolute inset-0: SVG fill