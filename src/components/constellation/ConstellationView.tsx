/**
 * ConstellationView Component
 * Main orchestrator for the mystical constellation visualization
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withSpring, withTiming, useDerivedValue, withRepeat, Easing } from 'react-native-reanimated';
import { ConstellationFriend, ConstellationFilter, SeasonTheme } from './types';
import { SocialSeason } from '../../db/models/UserProfile';
import {
  CANVAS_SIZE,
  ZOOM_CONFIG,
  SEASON_THEMES,
  PARTICLE_CONFIGS,
  ANIMATION_DURATIONS,
} from './config';
import { calculateAllPositions, getFilteredOpacity, getFilteredScale } from './utils';
import { ConstellationBackground } from './ConstellationBackground';
import { ParticleField } from './ParticleField';
import { DunbarRings } from './DunbarRings';
import { ConnectionLines } from './ConnectionLines';
import { FriendNodes } from './FriendNodes';
import { CenterNode } from './CenterNode';

interface ConstellationViewProps {
  friends: ConstellationFriend[];
  season: SocialSeason;
  filter?: ConstellationFilter;
  onFriendPress?: (friendId: string) => void;
  width?: number;
  height?: number;
}

export const ConstellationView: React.FC<ConstellationViewProps> = ({
  friends,
  season,
  filter,
  onFriendPress,
  width = Dimensions.get('window').width,
  height = Dimensions.get('window').height * 0.7,
}) => {
  const theme = SEASON_THEMES[season];
  const particleConfig = PARTICLE_CONFIGS[season];

  // Canvas center
  const centerX = width / 2;
  const centerY = height / 2;

  // Static progress values for now (animations disabled to avoid render conflicts)
  // TODO: Re-enable animations once Skia transform issue is resolved
  const particleProgress = useSharedValue(0.5);
  const ringProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0.5);
  const flowProgress = useSharedValue(0.5);

  // Gesture state
  const zoom = useSharedValue(ZOOM_CONFIG.default);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedZoom = useSharedValue(ZOOM_CONFIG.default);
  const savedOffsetX = useSharedValue(0);
  const savedOffsetY = useSharedValue(0);

  // Calculate friend positions
  const friendPositions = useMemo(() => {
    return calculateAllPositions(friends, centerX, centerY);
  }, [friends, centerX, centerY]);

  // Filter logic
  const { filteredFriends, filteredOpacity, filteredScale } = useMemo(() => {
    if (!filter || filter.mode === 'all') {
      return {
        filteredFriends: new Set(friends.map(f => f.id)),
        filteredOpacity: () => 1.0,
        filteredScale: () => 1.0,
      };
    }

    const matchingIds = new Set<string>();

    friends.forEach(friend => {
      let matches = false;

      switch (filter.mode) {
        case 'fading':
          matches = friend.weaveScore < 40;
          break;
        case 'momentum':
          matches = friend.hasMomentum;
          break;
        case 'tier':
          matches = filter.value ? friend.dunbarTier === filter.value : false;
          break;
        case 'archetype':
          matches = filter.value ? friend.archetype === filter.value : false;
          break;
      }

      if (matches) {
        matchingIds.add(friend.id);
      }
    });

    return {
      filteredFriends: matchingIds,
      filteredOpacity: getFilteredOpacity,
      filteredScale: getFilteredScale,
    };
  }, [friends, filter]);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      zoom.value = Math.max(
        ZOOM_CONFIG.min,
        Math.min(ZOOM_CONFIG.max, savedZoom.value * event.scale)
      );
    })
    .onEnd(() => {
      savedZoom.value = zoom.value;
    });

  // Pan gesture for movement
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      offsetX.value = savedOffsetX.value + event.translationX;
      offsetY.value = savedOffsetY.value + event.translationY;
    })
    .onEnd(() => {
      savedOffsetX.value = offsetX.value;
      savedOffsetY.value = offsetY.value;
    });

  // Double tap to reset
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      zoom.value = withSpring(ZOOM_CONFIG.default);
      offsetX.value = withSpring(0);
      offsetY.value = withSpring(0);
      savedZoom.value = ZOOM_CONFIG.default;
      savedOffsetX.value = 0;
      savedOffsetY.value = 0;
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={composedGesture}>
        <Canvas style={{ width, height }}>
          {/* Background */}
          <ConstellationBackground width={width} height={height} theme={theme} />

          {/* Particle field */}
          <ParticleField
            config={particleConfig}
            progress={particleProgress}
            width={width}
            height={height}
          />

          {/* Main constellation (with zoom/pan transform) */}
          {/* Note: Skia doesn't have direct Group transforms for zoom/pan,
              so we'll apply transforms to individual components or use a different approach.
              For now, rendering without pan/zoom - we can add this enhancement later */}

          {/* Dunbar rings */}
          <DunbarRings
            centerX={centerX}
            centerY={centerY}
            theme={theme}
            rotationProgress={ringProgress}
            highlightedTier={filter?.mode === 'tier' ? filter.value : undefined}
          />

          {/* Connection lines */}
          <ConnectionLines
            friends={friends}
            positions={friendPositions}
            centerX={centerX}
            centerY={centerY}
            theme={theme}
            flowProgress={flowProgress}
            opacity={1.0}
          />

          {/* Friend nodes */}
          {friends.map(friend => {
            const isMatching = filteredFriends.has(friend.id);
            return (
              <FriendNodes
                key={friend.id}
                friends={[friend]}
                positions={friendPositions}
                theme={theme}
                pulseProgress={pulseProgress}
                opacity={filteredOpacity(isMatching)}
                scale={filteredScale(isMatching)}
              />
            );
          })}

          {/* Center node (you) */}
          <CenterNode centerX={centerX} centerY={centerY} theme={theme} season={season} />
        </Canvas>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
  },
});
