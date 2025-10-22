import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { ThreadSegment } from './ThreadSegment';
import { ThreadNode, ThreadNodeLabel } from './ThreadNode';
import { generateMeanderingPath } from '../../lib/embroidery-utils';
import type FriendModel from '../../db/models/Friend';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EmbroideryTimelineProps {
  interactions: any[];
  friend: FriendModel;
  scrollY: Animated.SharedValue<number>;
  onNodePress: (interaction: any) => void;
  onNodeLongPress?: (interaction: any) => void;
}

/**
 * Main embroidery timeline container
 * Renders meandering thread path with interaction nodes
 */
export function EmbroideryTimeline({
  interactions,
  friend,
  scrollY,
  onNodePress,
  onNodeLongPress,
}: EmbroideryTimelineProps) {
  // Generate path data and node positions
  const { pathData, nodePositions, segments, totalHeight } = useMemo(() => {
    if (!interactions || interactions.length === 0) {
      return {
        pathData: '',
        nodePositions: [],
        segments: [],
        totalHeight: 0,
      };
    }

    return generateMeanderingPath(interactions, SCREEN_WIDTH, friend);
  }, [interactions, friend]);

  if (interactions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { height: totalHeight }]}>
      {/* SVG canvas for thread path and nodes */}
      <Svg width={SCREEN_WIDTH} height={totalHeight} style={styles.svg}>
        {/* Render thread segments with progressive reveal */}
        {segments.map((segment, index) => (
          <ThreadSegment
            key={`segment-${index}`}
            pathData={segment.pathData}
            ageInDays={segment.ageInDays}
            scrollY={scrollY}
            segmentStartY={segment.startY}
            segmentEndY={segment.endY}
            screenHeight={SCREEN_HEIGHT}
          />
        ))}

        {/* Render nodes */}
        {nodePositions.map((node) => (
          <ThreadNode
            key={node.id}
            x={node.x}
            y={node.y}
            cardX={node.cardX}
            cardY={node.cardY}
            size={node.size}
            interaction={node.interaction}
            scrollY={scrollY}
            screenHeight={SCREEN_HEIGHT}
            onPress={() => onNodePress(node.interaction)}
            onLongPress={() => onNodeLongPress?.(node.interaction)}
          />
        ))}
      </Svg>

      {/* Labels rendered as regular React Native views (outside SVG) */}
      {nodePositions.map((node) => (
        <ThreadNodeLabel
          key={`label-${node.id}`}
          x={node.cardX}
          y={node.cardY}
          size={node.size}
          interaction={node.interaction}
          onPress={() => onNodePress(node.interaction)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
