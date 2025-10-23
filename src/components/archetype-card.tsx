import React from 'react';
import { View, Text, Pressable, Vibration, StyleSheet } from 'react-native';
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
    Vibration.vibrate(50);
  };

  const iconColor = isSelected ? colors.primary : colors.foreground;
  const textColor = isSelected ? colors.primary : colors.foreground;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.container,
        { 
          backgroundColor: colors.card, 
          borderColor: isSelected ? colors.primary : colors.border 
        },
        isSelected && styles.containerSelected,
        { transform: [{ scale: pressed ? 0.97 : 1 }] }
      ]}
    >
      <ArchetypeIcon archetype={archetype} size={32} color={iconColor} />
      <Text style={[styles.name, { color: textColor }]}>
        {data.name.replace("The ", "")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        width: '100%',
        height: 96,
    },
    containerSelected: {
        // You can add extra styles for selected state here if needed
        // e.g., a subtle inner shadow or background pattern
    },
    name: {
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 16,
        fontSize: 14,
        marginTop: 8,
    },
});