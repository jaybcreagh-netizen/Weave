/**
 * MoonPhaseIllustration
 * Beautiful SVG moon rendering with battery-based illumination
 * Hand-drawn aesthetic with organic, slightly imperfect edges
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, G } from 'react-native-svg';

interface MoonPhaseIllustrationProps {
  phase: number; // 0-1 (0 = new moon/dark, 1 = full moon/bright)
  size?: number;
  hasCheckin?: boolean;
}

export function MoonPhaseIllustration({
  phase,
  size = 40,
  hasCheckin = true
}: MoonPhaseIllustrationProps) {
  // Color scheme
  const moonLit = '#F5F1E8'; // Cream color for illuminated portion
  const moonDark = '#2A2E3F'; // Dark blue-grey for shadowed portion
  const moonGlow = '#FFF9E5'; // Slight glow around full moons
  const noCheckinColor = '#3A3F52'; // Barely visible for unchecked days

  // If no check-in, render a very faint moon
  if (!hasCheckin) {
    return (
      <View style={{ width: size, height: size, opacity: 0.3 }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle
            cx="50"
            cy="50"
            r="45"
            fill={noCheckinColor}
            opacity={0.4}
          />
        </Svg>
      </View>
    );
  }

  /**
   * Calculate the illumination curve for the moon phase
   * This creates the characteristic crescent/gibbous shapes
   */
  const getIlluminationPath = (phase: number): string => {
    const centerX = 50;
    const centerY = 50;
    const radius = 45;

    if (phase <= 0.05) {
      // New moon - nearly invisible
      return `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`;
    }

    if (phase >= 0.95) {
      // Full moon - completely illuminated
      return `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`;
    }

    // Waxing phase (0.05 to 0.95)
    // The illuminated portion grows from right to left
    const offset = (phase - 0.5) * 2; // -1 to 1
    const curveRadius = radius * Math.abs(offset);
    const curveDirection = offset > 0 ? 0 : 1; // 0 = convex (waxing), 1 = concave (waning)

    // Since we're only showing waxing in battery context (1-5 = growing energy)
    // We'll always grow from right to left (waxing)
    const sweepFlag = offset > 0 ? 0 : 1;

    return `
      M ${centerX} ${centerY - radius}
      A ${radius} ${radius} 0 0 1 ${centerX} ${centerY + radius}
      A ${curveRadius} ${radius} 0 0 ${sweepFlag} ${centerX} ${centerY - radius}
      Z
    `;
  };

  const illuminationPath = getIlluminationPath(phase);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* Radial gradient for glow effect on full moons */}
          <RadialGradient id="moonGlow" cx="50%" cy="50%">
            <Stop offset="0%" stopColor={moonGlow} stopOpacity={phase > 0.8 ? "0.6" : "0"} />
            <Stop offset="70%" stopColor={moonGlow} stopOpacity={phase > 0.8 ? "0.2" : "0"} />
            <Stop offset="100%" stopColor={moonGlow} stopOpacity="0" />
          </RadialGradient>

          {/* Gradient for lit portion */}
          <RadialGradient id="moonLight" cx="45%" cy="45%">
            <Stop offset="0%" stopColor={moonLit} stopOpacity="1" />
            <Stop offset="85%" stopColor={moonLit} stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#E5DFD0" stopOpacity="0.9" />
          </RadialGradient>
        </Defs>

        {/* Glow effect for brighter moons */}
        {phase > 0.7 && (
          <Circle
            cx="50"
            cy="50"
            r="50"
            fill="url(#moonGlow)"
          />
        )}

        {/* Dark base circle (shadow side) */}
        <Circle
          cx="50"
          cy="50"
          r="45"
          fill={moonDark}
          opacity={0.9}
        />

        {/* Illuminated portion */}
        <Path
          d={illuminationPath}
          fill="url(#moonLight)"
        />

        {/* Subtle texture overlay for hand-drawn feel */}
        <Circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={moonLit}
          strokeWidth="0.5"
          opacity={phase * 0.3}
        />
      </Svg>
    </View>
  );
}
