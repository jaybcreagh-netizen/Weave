/**
 * CenterNode Component
 * Renders the central "you" node with seasonal icon
 */

import React from 'react';
import {
  Circle,
  Group,
  RadialGradient,
  vec,
  BlurMask,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { SeasonTheme } from './types';
import { SocialSeason } from '../../db/models/UserProfile';

interface CenterNodeProps {
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  season: SocialSeason;
  size?: number;
}

export const CenterNode: React.FC<CenterNodeProps> = ({
  centerX,
  centerY,
  theme,
  season,
  size = 40,
}) => {
  const seasonIcon = getSeasonIcon(season);

  // Font for emoji (fallback to system)
  const font = matchFont({
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: size * 0.8,
  });

  return (
    <Group>
      {/* Outer ambient glow */}
      <Circle cx={centerX} cy={centerY} r={size * 2} opacity={0.2}>
        <RadialGradient
          c={vec(centerX, centerY)}
          r={size * 2}
          colors={[theme.centerGlow, theme.centerGlow + '00']}
        />
        <BlurMask blur={20} style="normal" />
      </Circle>

      {/* Mid glow */}
      <Circle cx={centerX} cy={centerY} r={size * 1.5} opacity={0.3}>
        <RadialGradient
          c={vec(centerX, centerY)}
          r={size * 1.5}
          colors={[theme.centerGlow, theme.centerGlow + '00']}
        />
        <BlurMask blur={12} style="normal" />
      </Circle>

      {/* Main circle background */}
      <Circle cx={centerX} cy={centerY} r={size} color={theme.centerGlow} opacity={0.9} />

      {/* Inner glow */}
      <Circle cx={centerX} cy={centerY} r={size * 0.8}>
        <RadialGradient
          c={vec(centerX, centerY)}
          r={size * 0.8}
          colors={['#FFFFFF', theme.centerGlow]}
        />
      </Circle>

      {/* Season icon */}
      <SkiaText
        x={centerX - size * 0.4}
        y={centerY + size * 0.3}
        text={seasonIcon}
        font={font}
      />

      {/* Border ring */}
      <Circle
        cx={centerX}
        cy={centerY}
        r={size}
        style="stroke"
        strokeWidth={3}
        color="#FFFFFF"
        opacity={0.8}
      />
    </Group>
  );
};

/**
 * Get season icon emoji
 */
function getSeasonIcon(season: SocialSeason): string {
  const icons: Record<SocialSeason, string> = {
    resting: '🌙',
    balanced: '☀️',
    blooming: '✨',
  };
  return icons[season];
}
