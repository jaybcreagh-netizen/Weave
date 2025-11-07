import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../stores/uiStore';
import { type Archetype } from './types';
import { useTheme } from '../hooks/useTheme';
import { archetypeData } from '../lib/constants';
import { ArchetypeIcon } from './ArchetypeIcon';

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
  const iconColor = isSelected ? colors.primary : colors.foreground;
  const textColor = isSelected ? colors.primary : colors.foreground;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      className="relative rounded-2xl border-2 items-center justify-center p-3 w-full min-h-[120px] overflow-hidden"
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderColor: isSelected ? colors.primary : colors.border,
        shadowColor: isSelected ? colors.primary : '#000',
        shadowOpacity: isSelected ? 0.15 : 0.05,
        shadowOffset: isSelected ? { width: 0, height: 4 } : { width: 0, height: 2 },
        shadowRadius: isSelected ? 12 : 8,
        elevation: isSelected ? 4 : 2,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {/* Gradient Background */}
      <LinearGradient
        colors={[...gradient.map(c => c + '15'), 'transparent']}
        className="absolute inset-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <View className="relative z-10 items-center">
        <View
          className="w-[52px] h-[52px] rounded-xl border-[1.5px] items-center justify-center mb-2"
          style={{
            backgroundColor: isSelected ? colors.primary + '15' : colors.background,
            borderColor: isSelected ? colors.primary : colors.border,
          }}
        >
          <ArchetypeIcon archetype={archetype} size={28} color={iconColor} />
        </View>
        <Text
          className="text-center font-semibold text-sm mb-0.5"
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