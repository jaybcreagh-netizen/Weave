/**
 * ConnectionLines Component
 * Renders curved connection lines from center to each friend
 * with flowing particles along the path
 */

import React from 'react';
import { Circle, Group, Path, Skia, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { ConstellationFriend, ConstellationPosition, SeasonTheme } from './types';
import { CONNECTION_CONFIG, getConnectionWidth, getHealthColor } from './config';
import { getCurvedPath, getPointOnPath } from './utils';

interface ConnectionLinesProps {
  friends: ConstellationFriend[];
  positions: Map<string, ConstellationPosition>;
  centerX: number;
  centerY: number;
  theme: SeasonTheme;
  flowProgress: number; // 0-1, for particle flow animation
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
  flowProgress: number;
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
    const pathString = getCurvedPath(centerX, centerY, position.x, position.y, 0.15);
    return Skia.Path.MakeFromSVGString(pathString);
  }, [centerX, centerY, position]);

  // Calculate flowing particle positions
  const particlePositions = useDerivedValue(() => {
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < CONNECTION_CONFIG.particleCount; i++) {
      const offset = i / CONNECTION_CONFIG.particleCount;
      const t = (flowProgress + offset) % 1.0;
      const point = getPointOnPath(centerX, centerY, position.x, position.y, t, 0.15);
      positions.push(point);
    }
    return positions;
  }, [flowProgress, centerX, centerY, position]);

  return (
    <Group opacity={opacity}>
      {/* Connection line */}
      {path.value && (
        <Path
          path={path.value}
          style="stroke"
          strokeWidth={strokeWidth}
          color={healthColor}
          opacity={0.4}
        />
      )}

      {/* Flowing particles */}
      {particlePositions.value.map((pos, i) => (
        <Circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r={2.5}
          opacity={0.8}
        >
          <RadialGradient
            c={vec(2.5, 2.5)}
            r={2.5}
            colors={[healthColor, healthColor + '00']}
          />
        </Circle>
      ))}
    </Group>
  );
};
