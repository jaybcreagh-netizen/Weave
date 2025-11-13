import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../stores/uiStore';
import { type Archetype } from './types';
import { useTheme } from '../hooks/useTheme';
import { archetypeData } from '../lib/constants';

// Import SVG files as components
import EmperorSvg from '../../assets/TarotIcons/TheEmperor.svg';
import EmpressSvg from '../../assets/TarotIcons/TheEmpress.svg';
import HighPriestessSvg from '../../assets/TarotIcons/HighPriestess.svg';
import FoolSvg from '../../assets/TarotIcons/TheFool.svg';
import SunSvg from '../../assets/TarotIcons/TheSun.svg';
import HermitSvg from '../../assets/TarotIcons/TheHermit.svg';
import MagicianSvg from '../../assets/TarotIcons/TheMagician.svg';
import LoversSvg from '../../assets/TarotIcons/TheLovers.svg';

interface ArchetypeCardProps {
  archetype: Archetype;
  isSelected?: boolean;
  onSelect?: (archetype: Archetype) => void;
}

const ARCHETYPE_GRADIENTS: Record<Archetype, string[]> = {
  Emperor: ['#ef4444', '#dc2626'],
  Empress: ['#10b981', '#059669'],
  HighPriestess: ['#8b5cf6', '#7c3aed'],
  Fool: ['#f59e0b', '#d97706'],
  Sun: ['#eab308', '#ca8a04'],
  Hermit: ['#6366f1', '#4f46e5'],
  Magician: ['#ec4899', '#db2777'],
  Lovers: ['#fb7185', '#f43f5e'],
};

// Map archetypes to their tarot card SVG components
const TAROT_CARD_COMPONENTS: Record<Archetype, React.FC<any>> = {
  Emperor: EmperorSvg,
  Empress: EmpressSvg,
  HighPriestess: HighPriestessSvg,
  Fool: FoolSvg,
  Sun: SunSvg,
  Hermit: HermitSvg,
  Magician: MagicianSvg,
  Lovers: LoversSvg,
};

export function ArchetypeCard({
    archetype,
    isSelected = false,
    onSelect,
}: ArchetypeCardProps) {
  const { setArchetypeModal } = useUIStore();
  const { colors } = useTheme();
  const data = archetypeData[archetype];

  if (!data) {
    return null;
  }

  const handlePress = () => {
    if (onSelect) {
      onSelect(archetype);
    }
  };

  const handleLongPress = () => {
    setArchetypeModal(archetype);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const gradient = ARCHETYPE_GRADIENTS[archetype] || ['#6b7280', '#4b5563'];
  const textColor = isSelected ? colors.primary : colors.foreground;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      className="relative rounded-2xl items-center justify-center p-2 w-full min-h-[180px] overflow-hidden"
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderWidth: isSelected ? 3 : 0,
        borderColor: isSelected ? gradient[0] : 'transparent',
        shadowColor: isSelected ? gradient[0] : '#000',
        shadowOpacity: isSelected ? 0.4 : 0.05,
        shadowOffset: isSelected ? { width: 0, height: 6 } : { width: 0, height: 2 },
        shadowRadius: isSelected ? 16 : 8,
        elevation: isSelected ? 8 : 2,
        transform: [{ scale: pressed ? 0.95 : isSelected ? 1.03 : 1 }],
      })}
    >
      {/* Gradient Background - more prominent when selected */}
      <LinearGradient
        colors={[...gradient.map(c => c + (isSelected ? 'E6' : '10')), 'transparent']}
        className="absolute inset-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <View className="relative z-10 items-center" style={{ opacity: isSelected ? 1 : 0.5 }}>
        {/* Tarot Card SVG */}
        <View
          className="mb-1.5"
          style={{
            width: 80,
            height: 120,
            shadowColor: gradient[0],
            shadowOpacity: isSelected ? 0.4 : 0.1,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            elevation: isSelected ? 4 : 2,
          }}
        >
          {React.createElement(TAROT_CARD_COMPONENTS[archetype], {
            width: 80,
            height: 120,
            color: colors.foreground,
          })}
        </View>
        <Text
          className="text-center font-semibold text-xs mb-0.5"
          style={{ color: textColor }}
        >
          {data.name.replace("The ", "")}
        </Text>
        <Text
          className="text-center text-[10px] leading-[14px] px-1"
          style={{ color: colors['muted-foreground'] }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {data.essence}
        </Text>
      </View>
    </Pressable>
  );
}