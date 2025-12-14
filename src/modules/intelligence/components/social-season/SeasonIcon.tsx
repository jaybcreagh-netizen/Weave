import React from 'react';
import { type SocialSeason } from '@/modules/intelligence';

// Import season SVG icons
import RestingIcon from '@/assets/icons/resting.svg';
import BalancedIcon from '@/assets/icons/Balanced.svg';
import BloomingIcon from '@/assets/icons/blooming.svg';

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
