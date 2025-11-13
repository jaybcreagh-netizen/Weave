/**
 * DunbarRings Component
 * Renders the concentric orbital rings for each Dunbar tier
 */

import React from 'react';
import { Circle, Group, Path, Skia, DashPathEffect, BlurMask } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { Tier } from '../types';
import { RING_RADII, RING_CONFIG } from './config';
import { SeasonTheme } from './types';
import { degToRad } from './utils';

interface DunbarRingsProps {
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  rotationProgress: number; // 0-1, for slow rotation animation
  highlightedTier?: Tier; // Optional tier to highlight
}

export const DunbarRings: React.FC<DunbarRingsProps> = ({
  centerX,
  centerY,
  theme,
  rotationProgress,
  highlightedTier,
}) => {
  const tiers: Tier[] = ['InnerCircle', 'CloseFriends', 'Community'];

  return (
    <Group>
      {tiers.map((tier) => (
        <DunbarRing
          key={tier}
          tier={tier}
          centerX={centerX}
          centerY={centerY}
          theme={theme}
          rotationProgress={rotationProgress}
          isHighlighted={highlightedTier === tier}
        />
      ))}
    </Group>
  );
};

interface DunbarRingProps {
  tier: Tier;
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  rotationProgress: number;
  isHighlighted: boolean;
}

const DunbarRing: React.FC<DunbarRingProps> = ({
  tier,
  centerX,
  centerY,
  theme,
  rotationProgress,
  isHighlighted,
}) => {
  const radius = RING_RADII[tier];

  // Create path for the ring
  const path = useDerivedValue(() => {
    const circlePath = Skia.Path.Make();
    circlePath.addCircle(centerX, centerY, radius);
    return circlePath;
  }, [centerX, centerY, radius]);

  // Calculate rotation angle
  const rotation = useDerivedValue(() => {
    return rotationProgress * 360; // Full rotation over the animation loop
  }, [rotationProgress]);

  // Determine opacity based on highlight state
  const opacity = isHighlighted ? 1.0 : 0.4;
  const glowOpacity = isHighlighted ? RING_CONFIG.glowIntensity * 1.5 : RING_CONFIG.glowIntensity;

  return (
    <Group
      transform={[
        { translateX: centerX },
        { translateY: centerY },
        { rotate: degToRad(rotation.value) },
        { translateX: -centerX },
        { translateY: -centerY },
      ]}
    >
      {/* Outer glow */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={RING_CONFIG.strokeWidth + 2}
        color={theme.ringColor}
        opacity={glowOpacity}
      >
        <BlurMask blur={6} style="normal" />
      </Path>

      {/* Main ring with dash pattern */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={RING_CONFIG.strokeWidth}
        color={theme.ringColor}
        opacity={opacity}
      >
        {RING_CONFIG.dashArray && (
          <DashPathEffect intervals={RING_CONFIG.dashArray} />
        )}
      </Path>
    </Group>
  );
};

/**
 * Get tier label for debugging/development
 */
export function getTierLabel(tier: Tier): string {
  const labels: Record<Tier, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
  };
  return labels[tier];
}

/**
 * Get tier ring count (for stats display)
 */
export function getTierRingCount(tier: Tier, friends: any[]): number {
  return friends.filter(f => f.dunbarTier === tier).length;
}
