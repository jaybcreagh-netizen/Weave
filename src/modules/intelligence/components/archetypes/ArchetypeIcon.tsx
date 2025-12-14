import React from 'react';
import { type Archetype } from '@/shared/types/common';
import { SvgProps } from 'react-native-svg';

import EmperorIcon from '@/assets/TarotIcons/TheEmperor.svg';
import EmpressIcon from '@/assets/TarotIcons/TheEmpress.svg';
import HighPriestessIcon from '@/assets/TarotIcons/HighPriestess.svg';
import FoolIcon from '@/assets/TarotIcons/TheFool.svg';
import SunIcon from '@/assets/TarotIcons/TheSun.svg';
import HermitIcon from '@/assets/TarotIcons/TheHermit.svg';
import MagicianIcon from '@/assets/TarotIcons/TheMagician.svg';
import LoversIcon from '@/assets/TarotIcons/TheLovers.svg';

interface ArchetypeIconProps {
  archetype: Archetype;
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  style?: any;
}

export function ArchetypeIcon({ archetype, size = 24, width, height, color, style }: ArchetypeIconProps) {
  const iconProps: SvgProps = {
    width: width || size,
    height: height || size,
    fill: color,
    style
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
