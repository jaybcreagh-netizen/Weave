import React from 'react';
import { View, Text, Pressable, Vibration, StyleSheet } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { type Archetype } from './types';
import { theme } from '../theme';
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

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.containerSelected,
        { transform: [{ scale: pressed ? 0.97 : 1 }] }
      ]}
    >
      <ArchetypeIcon archetype={archetype} size={32} color={isSelected ? theme.colors.primary : theme.colors.foreground} />
      <Text style={styles.name}>
        {data.name.replace("The ", "")}
      </Text>
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <View style={styles.selectedIndicatorInner} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        width: '100%',
        height: 96,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
    },
    containerSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: 'rgba(181, 138, 108, 0.05)',
    },
    icon: {
        fontSize: 32,
        marginBottom: 4,
    },
    name: {
        textAlign: 'center',
        fontWeight: '500',
        color: theme.colors.foreground,
        lineHeight: 16,
        fontSize: 14,
    },
    selectedIndicator: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    selectedIndicatorInner: {
        width: 8,
        height: 8,
        backgroundColor: 'white',
        borderRadius: 4,
    }
});