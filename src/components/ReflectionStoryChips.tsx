import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getChipsForType, getChipTypeLabel, type StoryChip, type ChipType } from '@/modules/reflection';
import { type InteractionCategory, type Archetype, type Vibe, type Tier } from './types';
import { useTheme } from '@/shared/hooks/useTheme';
import { getChipFrequencyScores, getCustomChipsAsStoryChips } from '../lib/adaptive-chips';

interface ReflectionStoryChipsProps {
  chipType: ChipType;
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  tier?: Tier; // For tier-aware filtering
  interactionCount?: number; // Total interactions with friend (for history awareness)
  daysSinceLastInteraction?: number; // For reconnection context
  userText?: string; // User's custom notes for contextual filtering
  onChipSelect: (chip: StoryChip) => void;
}

/**
 * Displays horizontally scrollable chips for a specific chip type
 * Filtered by smart context (category, archetype, vibe, tier, history, frequency)
 */
export function ReflectionStoryChips({
  chipType,
  category,
  archetype,
  vibe,
  tier,
  interactionCount,
  daysSinceLastInteraction,
  userText,
  onChipSelect,
}: ReflectionStoryChipsProps) {
  const { colors } = useTheme();
  const [frequencyScores, setFrequencyScores] = useState<Record<string, number>>({});
  const [customChips, setCustomChips] = useState<StoryChip[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Load frequency scores and custom chips on mount
  useEffect(() => {
    const loadAdaptiveData = async () => {
      try {
        const [scores, custom] = await Promise.all([
          getChipFrequencyScores(),
          getCustomChipsAsStoryChips(),
        ]);
        setFrequencyScores(scores);
        setCustomChips(custom.filter(c => c.type === chipType));
      } catch (error) {
        console.error('Error loading adaptive chip data:', error);
      }
    };
    loadAdaptiveData();
  }, [chipType]);

  const standardChips = getChipsForType(chipType, {
    category,
    archetype,
    vibe: vibe || undefined,
    tier,
    interactionCount,
    daysSinceLastInteraction,
    frequencyScores,
    userText,
  });

  // Combine standard and custom chips
  const allChips = [...standardChips, ...customChips];

  // Progressive disclosure: show top 5, then allow expansion
  const visibleChips = showAll ? allChips : allChips.slice(0, 5);
  const hasMore = allChips.length > 5;

  if (allChips.length === 0) {
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
        {visibleChips.map((chip, index) => (
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

        {/* Show more/less button */}
        {hasMore && (
          <TouchableOpacity
            style={[
              styles.showMoreButton,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowAll(!showAll)}
            activeOpacity={0.7}
          >
            <Text style={[styles.showMoreText, { color: colors['muted-foreground'] }]}>
              {showAll ? 'Show less' : `+${allChips.length - 5} more`}
            </Text>
          </TouchableOpacity>
        )}
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
  showMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
