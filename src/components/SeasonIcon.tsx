import React from 'react';
import Svg, { SvgProps } from 'react-native-svg';
import { type SocialSeason } from '../lib/social-season/season-types';

// Import season SVG icons
const RestingIcon = require('@/assets/icons/resting.svg').default;
const BalancedIcon = require('@/assets/icons/Balanced.svg').default;
const BloomingIcon = require('@/assets/icons/blooming.svg').default;

interface SeasonIconProps {
  season: SocialSeason;
  size: number;
  color?: string;
}

export function SeasonIcon({ season, size, color = '#000000' }: SeasonIconProps) {
  const iconProps = {
    width: size,
    height: size,
    fill: color,
    stroke: color,
    color: color,
  };

  switch (season) {
    case 'resting':
      return <RestingIcon {...iconProps} />;
    case 'balanced':
      return <BalancedIcon {...iconProps} />;
    case 'blooming':
      return <BloomingIcon {...iconProps} />;
    default:
      return null;
  }
}
