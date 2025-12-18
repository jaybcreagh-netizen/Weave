import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getChipsForType, getChipTypeLabel, type StoryChip, type ChipType } from '@/modules/reflection';
import { type InteractionCategory, type Archetype, type Vibe, type Tier } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { getChipFrequencyScores, getCustomChipsAsStoryChips } from '@/modules/reflection';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';

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
  const { colors, tokens } = useTheme();
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
    <View className="gap-3">
      <Text className="font-inter-medium text-xs ml-1" style={{ color: colors['muted-foreground'] }}>
        {getChipTypeLabel(chipType)}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 16 }}
      >
        {visibleChips.map((chip, index) => (
          <Animated.View
            key={chip.id}
            entering={FadeIn.duration(300).delay(index * 50)}
          >
            <TouchableOpacity
              className="py-2 px-3 rounded-[16px] border shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: tokens?.shadow.color || '#000',
                shadowOpacity: tokens?.shadow.opacity.sm || 0.05,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 3,
              }}
              onPress={() => onChipSelect(chip)}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.foreground, fontSize: 13 }}>
                {chip.plainText}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {/* Show more/less button */}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowAll(!showAll)}
            label={showAll ? 'Show less' : `+${allChips.length - 5} more`}
            style={{
              alignSelf: 'center',
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              height: 48, // matching chip height roughly
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}
