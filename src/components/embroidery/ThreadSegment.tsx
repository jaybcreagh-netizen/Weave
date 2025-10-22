import React, { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Path } from 'react-native-svg';
import { getThreadStyle } from '../../lib/embroidery-utils';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface ThreadSegmentProps {
  pathData: string;
  ageInDays: number;
  scrollY: Animated.SharedValue<number>;
  segmentStartY: number;
  segmentEndY: number;
  screenHeight: number;
}

/**
 * Individual thread segment with progressive reveal animation
 * Draws as user scrolls, creating "stitching in" effect
 */
export function ThreadSegment({
  pathData,
  ageInDays,
  scrollY,
  segmentStartY,
  segmentEndY,
  screenHeight,
}: ThreadSegmentProps) {
  const pathLength = useSharedValue(0);
  const progress = useSharedValue(0);

  // Get styling based on age
  const { strokeDasharray, stroke, strokeWidth, hasGlow } = getThreadStyle(ageInDays);

  // Calculate path length (approximation for animation)
  // In production, you'd measure actual SVG path length
  const estimatedLength = Math.sqrt(
    Math.pow(segmentEndY - segmentStartY, 2) + Math.pow(80, 2) // Max horizontal offset
  );

  useEffect(() => {
    pathLength.value = estimatedLength;
  }, [estimatedLength]);

  // Animated props for progressive reveal
  const animatedProps = useAnimatedProps(() => {
    // Calculate if segment is in viewport
    const visibleTop = scrollY.value;
    const visibleBottom = scrollY.value + screenHeight;

    // Progress from 0 to 1 as segment enters viewport
    const revealProgress = interpolate(
      visibleBottom,
      [segmentStartY - 100, segmentEndY],
      [0, 1],
      'clamp'
    );

    // Animate progress smoothly
    progress.value = withTiming(revealProgress, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });

    // Create drawing effect with strokeDashoffset
    const dashOffset = pathLength.value * (1 - progress.value);

    return {
      strokeDashoffset: dashOffset,
      strokeDasharray: strokeDasharray || `${pathLength.value} ${pathLength.value}`,
      opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.6, 1]),
    };
  });

  return (
    <>
      {/* Main thread path */}
      <AnimatedPath
        d={pathData}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={animatedProps}
      />

      {/* Glow effect for recent threads */}
      {hasGlow && (
        <AnimatedPath
          d={pathData}
          stroke="rgba(212, 175, 55, 0.4)"
          strokeWidth={strokeWidth + 2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          animatedProps={animatedProps}
          opacity={0.6}
        />
      )}
    </>
  );
}
