import React from 'react';
import { type Archetype } from './types';
import { SvgProps } from 'react-native-svg';

// Import tarot SVG icons - using require for SVG imports
const EmperorIcon = require('../../assets/TarotIcons/TheEmperor.svg').default;
const EmpressIcon = require('../../assets/TarotIcons/TheEmpress.svg').default;
const HighPriestessIcon = require('../../assets/TarotIcons/HighPriestess.svg').default;
const FoolIcon = require('../../assets/TarotIcons/TheFool.svg').default;
const SunIcon = require('../../assets/TarotIcons/TheSun.svg').default;
const HermitIcon = require('../../assets/TarotIcons/TheHermit.svg').default;
const MagicianIcon = require('../../assets/TarotIcons/TheMagician.svg').default;
const LoversIcon = require('../../assets/TarotIcons/TheLovers.svg').default;

interface ArchetypeIconProps {
  archetype: Archetype;
  size: number;
  color: string;
}

export function ArchetypeIcon({ archetype, size, color }: ArchetypeIconProps) {
  const iconProps: SvgProps = {
    width: size,
    height: size,
    fill: color,
  };

  switch (archetype) {
    case 'Emperor': return <EmperorIcon {...iconProps} />;
    case 'Empress': return <EmpressIcon {...iconProps} />;
    case 'HighPriestess': return <HighPriestessIcon {...iconProps} />;
    case 'Fool': return <FoolIcon {...iconProps} />;
    case 'Sun': return <SunIcon {...iconProps} />;
    case 'Hermit': return <HermitIcon {...iconProps} />;
    case 'Magician': return <MagicianIcon {...iconProps} />;
    case 'Lovers': return <LoversIcon {...iconProps} />;
    case 'Unknown': return null;
    default: return null;
  }
}
