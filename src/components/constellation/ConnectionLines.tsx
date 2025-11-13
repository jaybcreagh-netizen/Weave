/**
 * ConnectionLines Component
 * Renders curved connection lines from center to each friend
 * with flowing particles along the path
 */

import React from 'react';
import { Circle, Group, Path, Skia, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';
import { ConstellationFriend, ConstellationPosition, SeasonTheme } from './types';
import { CONNECTION_CONFIG, getConnectionWidth, getHealthColor } from './config';
import { getCurvedPath, getPointOnPath } from './utils';

interface ConnectionLinesProps {
  friends: ConstellationFriend[];
  positions: Map<string, ConstellationPosition>;
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  flowProgress: SharedValue<number> | number; // 0-1, for particle flow animation
  opacity?: number; // For filter effects
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  friends,
  positions,
  centerX,
  centerY,
  theme,
  flowProgress,
  opacity = 1.0,
}) => {
  return (
    <Group>
      {friends.map((friend) => {
        const position = positions.get(friend.id);
        if (!position) return null;

        return (
          <ConnectionLine
            key={friend.id}
            friend={friend}
            position={position}
            centerX={centerX}
            centerY={centerY}
            theme={theme}
            flowProgress={flowProgress}
            opacity={opacity}
          />
        );
      })}
    </Group>
  );
};

interface ConnectionLineProps {
  friend: ConstellationFriend;
  position: ConstellationPosition;
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  flowProgress: SharedValue<number> | number;
  opacity: number;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  friend,
  position,
  centerX,
  centerY,
  theme,
  flowProgress,
  opacity,
}) => {
  const healthColor = getHealthColor(friend.weaveScore, theme);
  const strokeWidth = getConnectionWidth(friend.weaveScore);

  // Create curved path
  const path = useDerivedValue(() => {
    'worklet';
    const pathString = getCurvedPath(centerX, centerY, position.x, position.y, 0.15);
    return Skia.Path.MakeFromSVGString(pathString);
  }, [centerX, centerY, position]);

  // Generate static particle indices
  const particleIndices = Array.from({ length: CONNECTION_CONFIG.particleCount }, (_, i) => i);

  return (
    <Group opacity={opacity}>
      {/* Connection line */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        color={healthColor}
        opacity={0.4}
      />

      {/* Flowing particles - create each particle's position as a derived value */}
      {particleIndices.map((i) => (
        <FlowingParticle
          key={i}
          index={i}
          totalParticles={CONNECTION_CONFIG.particleCount}
          flowProgress={flowProgress}
          centerX={centerX}
          centerY={centerY}
          position={position}
          healthColor={healthColor}
        />
      ))}
    </Group>
  );
};

interface FlowingParticleProps {
  index: number;
  totalParticles: number;
  flowProgress: number;
  centerX: number;
  centerY: number;
  position: ConstellationPosition;
  healthColor: string;
}

const FlowingParticle: React.FC<FlowingParticleProps> = ({
  index,
  totalParticles,
  flowProgress,
  centerX,
  centerY,
  position,
  healthColor,
}) => {
  // Calculate this particle's position along the path
  const particleX = useDerivedValue(() => {
    'worklet';
    const progressValue = typeof flowProgress === 'number' ? flowProgress : flowProgress.value;
    const offset = index / totalParticles;
    const t = (progressValue + offset) % 1.0;
    const point = getPointOnPath(centerX, centerY, position.x, position.y, t, 0.15);
    return point.x;
  }, [flowProgress, index, totalParticles, centerX, centerY, position]);

  const particleY = useDerivedValue(() => {
    'worklet';
    const progressValue = typeof flowProgress === 'number' ? flowProgress : flowProgress.value;
    const offset = index / totalParticles;
    const t = (progressValue + offset) % 1.0;
    const point = getPointOnPath(centerX, centerY, position.x, position.y, t, 0.15);
    return point.y;
  }, [flowProgress, index, totalParticles, centerX, centerY, position]);

  return (
    <Circle
      cx={particleX}
      cy={particleY}
      r={2.5}
      opacity={0.8}
    >
      <RadialGradient
        c={vec(2.5, 2.5)}
        r={2.5}
        colors={[healthColor, healthColor + '00']}
      />
    </Circle>
  );
};
