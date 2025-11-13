/**
 * FriendNodes Component
 * Renders friend avatars as nodes with glow effects and animations
 */

import React from 'react';
import {
  Circle,
  Group,
  RadialGradient,
  vec,
  BlurMask,
  Image,
  useImage,
  Paint,
  Skia,
} from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';
import { ConstellationFriend, ConstellationPosition, SeasonTheme } from './types';
import { NODE_CONFIG, getNodeSize, getHealthColor } from './config';

interface FriendNodesProps {
  friends: ConstellationFriend[];
  positions: Map<string, ConstellationPosition>;
  theme: SeasonTheme;
  pulseProgress: SharedValue<number> | number; // 0-1, for momentum pulse animation
  onFriendPress?: (friendId: string) => void;
  opacity?: number; // For filter effects
  scale?: number; // For filter highlight
}

export const FriendNodes: React.FC<FriendNodesProps> = ({
  friends,
  positions,
  theme,
  pulseProgress,
  opacity = 1.0,
  scale = 1.0,
}) => {
  return (
    <Group>
      {friends.map((friend) => {
        const position = positions.get(friend.id);
        if (!position) return null;

        return (
          <FriendNode
            key={friend.id}
            friend={friend}
            position={position}
            theme={theme}
            pulseProgress={pulseProgress}
            opacity={opacity}
            scale={scale}
          />
        );
      })}
    </Group>
  );
};

interface FriendNodeProps {
  friend: ConstellationFriend;
  position: ConstellationPosition;
  theme: SeasonTheme;
  pulseProgress: SharedValue<number> | number;
  opacity: number;
  scale: number;
}

const FriendNode: React.FC<FriendNodeProps> = ({
  friend,
  position,
  theme,
  pulseProgress,
  opacity,
  scale,
}) => {
  const nodeSize = getNodeSize(friend.weaveScore);
  const healthColor = getHealthColor(friend.weaveScore, theme);

  // TODO: Re-enable pulse/scale animation with proper Skia animation support
  // For now, use static scale to avoid SharedValue in transform error
  const staticScale = scale;

  return (
    <Group
      transform={[
        { translateX: position.x },
        { translateY: position.y },
        { scale: staticScale },
        { translateX: -position.x },
        { translateY: -position.y },
      ]}
      opacity={opacity}
    >
      {/* Outer glow */}
      <Circle cx={position.x} cy={position.y} r={NODE_CONFIG.glowRadius} opacity={0.4}>
        <RadialGradient
          c={vec(position.x, position.y)}
          r={NODE_CONFIG.glowRadius}
          colors={[healthColor, healthColor + '00']}
        />
        <BlurMask blur={NODE_CONFIG.glowBlur} style="normal" />
      </Circle>

      {/* Avatar background circle (fallback if no image) */}
      <Circle
        cx={position.x}
        cy={position.y}
        r={nodeSize}
        color={healthColor}
        opacity={0.3}
      />

      {/* Avatar image */}
      {friend.avatar ? (
        <FriendAvatar
          uri={friend.avatar}
          cx={position.x}
          cy={position.y}
          radius={nodeSize}
        />
      ) : (
        // Fallback: Initials or gradient
        <Circle
          cx={position.x}
          cy={position.y}
          r={nodeSize}
        >
          <RadialGradient
            c={vec(position.x, position.y)}
            r={nodeSize}
            colors={[healthColor, healthColor + '99']}
          />
        </Circle>
      )}

      {/* Border ring */}
      <Circle
        cx={position.x}
        cy={position.y}
        r={nodeSize}
        style="stroke"
        strokeWidth={NODE_CONFIG.borderWidth}
        color={healthColor}
      />

      {/* Momentum indicator (small spark) */}
      {friend.hasMomentum && (
        <Circle
          cx={position.x + nodeSize * 0.7}
          cy={position.y - nodeSize * 0.7}
          r={4}
          opacity={0.8}
        >
          <RadialGradient
            c={vec(position.x + nodeSize * 0.7, position.y - nodeSize * 0.7)}
            r={4}
            colors={['#FFD700', '#FFD70000']} // Gold spark
          />
        </Circle>
      )}
    </Group>
  );
};

interface FriendAvatarProps {
  uri: string;
  cx: number;
  cy: number;
  radius: number;
}

const FriendAvatar: React.FC<FriendAvatarProps> = ({ uri, cx, cy, radius }) => {
  const image = useImage(uri);

  // Create circular clip path
  const clipPath = React.useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(cx, cy, radius);
    return path;
  }, [cx, cy, radius]);

  if (!image) {
    return null;
  }

  return (
    <Group clip={clipPath}>
      <Image
        image={image}
        x={cx - radius}
        y={cy - radius}
        width={radius * 2}
        height={radius * 2}
        fit="cover"
      />
    </Group>
  );
};
