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
          borderColor: isSelected ? colors.primary : colors.border,
          shadowColor: isSelected ? colors.primary : '#000',
          shadowOpacity: isSelected ? 0.15 : 0.05,
        },
        isSelected && styles.containerSelected,
        { transform: [{ scale: pressed ? 0.95 : 1 }] }
      ]}
    >
      <View style={[
        styles.iconBox,
        {
          backgroundColor: isSelected ? colors.primary + '15' : colors.background,
          borderColor: isSelected ? colors.primary : colors.border,
        }
      ]}>
        <ArchetypeIcon archetype={archetype} size={28} color={iconColor} />
      </View>
      <Text style={[styles.name, { color: textColor }]}>
        {data.name.replace("The ", "")}
      </Text>
      <Text style={[styles.essence, { color: colors['muted-foreground'] }]} numberOfLines={1} ellipsizeMode="tail">
        {data.essence}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        width: '100%',
        minHeight: 120,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    containerSelected: {
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 4,
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    name: {
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 18,
        fontSize: 14,
        marginBottom: 2,
    },
    essence: {
        textAlign: 'center',
        fontSize: 10,
        lineHeight: 14,
        fontWeight: '400',
        paddingHorizontal: 4,
    },
});