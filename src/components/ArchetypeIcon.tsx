import React from 'react';
import {
  Crown, Flower2, Moon, Feather, Sun, Mountain, Sparkles, GitMerge
} from 'lucide-react-native';
import { type Archetype } from './types';
import { ARCHETYPE_DETAILS } from '../lib/archetype-data';

interface ArchetypeIconProps {
  archetype: Archetype;
  size: number;
  color: string;
}

export function ArchetypeIcon({ archetype, size, color }: ArchetypeIconProps) {
  const iconName = ARCHETYPE_DETAILS[archetype]?.icon;

  switch (iconName) {
    case 'Crown': return <Crown size={size} color={color} />;
    case 'Flower2': return <Flower2 size={size} color={color} />;
    case 'Moon': return <Moon size={size} color={color} />;
    case 'Feather': return <Feather size={size} color={color} />;
    case 'Sun': return <Sun size={size} color={color} />;
    case 'Mountain': return <Mountain size={size} color={color} />;
    case 'Sparkles': return <Sparkles size={size} color={color} />;
    case 'GitMerge': return <GitMerge size={size} color={color} />;
    default: return null;
  }
}
