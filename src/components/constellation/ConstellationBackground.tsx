/**
 * ConstellationBackground Component
 * Renders the mystical background with seasonal gradients
 */

import React from 'react';
import { Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import { SeasonTheme } from './types';

interface ConstellationBackgroundProps {
  width: number;
  height: number;
  theme: SeasonTheme;
}

export const ConstellationBackground: React.FC<ConstellationBackgroundProps> = ({
  width,
  height,
  theme,
}) => {
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient
        start={vec(width / 2, 0)}
        end={vec(width / 2, height)}
        colors={theme.backgroundColor}
      />
    </Rect>
  );
};
