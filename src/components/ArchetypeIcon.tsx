import React from 'react';
import { type Archetype } from './types';
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
