import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getChipsForType, getChipTypeLabel, type StoryChip, type ChipType } from '../lib/story-chips';
import { type InteractionCategory, type Archetype, type Vibe } from './types';
import { useTheme } from '../hooks/useTheme';

interface ReflectionStoryChipsProps {
  chipType: ChipType;
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  onChipSelect: (chip: StoryChip) => void;
}

/**
 * Displays horizontally scrollable chips for a specific chip type
 * Filtered by context (category, archetype, vibe)
 */
export function ReflectionStoryChips({
  chipType,
  category,
  archetype,
  vibe,
  onChipSelect,
}: ReflectionStoryChipsProps) {
  const { colors } = useTheme();

  const chips = getChipsForType(chipType, {
    category,
    archetype,
    vibe: vibe || undefined,
  });

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors['muted-foreground'] }]}>
        {getChipTypeLabel(chipType)}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map((chip, index) => (
          <Animated.View
            key={chip.id}
            entering={FadeIn.duration(300).delay(index * 50)}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onChipSelect(chip)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: colors.foreground }]}>
                {chip.plainText}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
