import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ReflectionStoryChips } from './ReflectionStoryChips';
import { ReflectionTextInput } from './ReflectionTextInput';
import { getNextChipType, STORY_CHIPS, type StoryChip, type ChipType } from '../lib/story-chips';
import { type InteractionCategory, type Archetype, type Vibe, type Tier } from './types';
import { type StructuredReflection } from '../stores/interactionStore';
import { useTheme } from '../hooks/useTheme';
import { analyzeText, generateContextualPrompt, calculateReflectionQuality } from '../lib/text-analysis';
import { STORY_CHIPS as ALL_STORY_CHIPS } from '../lib/story-chips';
import { generatePatternInsights, type PatternInsight } from '../lib/adaptive-chips';

interface ContextualReflectionInputProps {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  tier?: Tier; // Optional: for tier-aware suggestions
  interactionCount?: number; // Optional: for history-aware suggestions
  daysSinceLastInteraction?: number; // Optional: for reconnection context
  friendId?: string; // Optional: for friend-specific pattern insights (single friend only)
  value: StructuredReflection;
  onChange: (reflection: StructuredReflection) => void;
}

/**
 * Story builder reflection input
 *
 * Flow:
 * 1. Show next chip type in sequence (activity → setting → people → dynamic → topic → feeling → moment → surprise)
 * 2. User taps chip → appears as bubble card in text input
 * 3. User can tap colored words in bubble to customize
 * 4. Next chip type appears automatically
 * 5. User can type additional notes at any time
 * 6. Smart filtering based on archetype, tier, history, and frequency
 */
export function ContextualReflectionInput({
  category,
  archetype,
  vibe,
  tier,
  interactionCount,
  daysSinceLastInteraction,
  friendId,
  value,
  onChange,
}: ContextualReflectionInputProps) {
  const { colors } = useTheme();
  const [nextChipType, setNextChipType] = useState<ChipType | null>('activity');
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([]);

  // Generate contextual prompt based on user's text
  const contextualPrompt = useMemo(() => {
    if (!value.customNotes || value.customNotes.trim().length === 0) {
      return null;
    }
    const themes = analyzeText(value.customNotes);
    return generateContextualPrompt(themes);
  }, [value.customNotes]);

  // Calculate reflection quality
  const reflectionQuality = useMemo(() => {
    const chipCount = (value.chips || []).length;
    const uniqueChipTypes = new Set(
      (value.chips || []).map(chip => {
        const storyChip = ALL_STORY_CHIPS.find(s => s.id === chip.chipId);
        return storyChip?.type;
      }).filter(Boolean)
    ).size;

    const customNotesLength = (value.customNotes || '').trim().length;

    // Check for vulnerability chips (deep, personal, struggles themes)
    const vulnerabilityChipIds = [
      'dynamic_i-opened-up',
      'dynamic_they-opened-up',
      'topic_fears',
      'topic_struggles',
      'feeling_exhausted-good',
      'moment_shared-something',
      'moment_they-shared',
      'surprise_deeper-than-expected',
    ];
    const hasVulnerabilityChips = (value.chips || []).some(chip =>
      vulnerabilityChipIds.includes(chip.chipId)
    );

    const themes = customNotesLength > 0 ? analyzeText(value.customNotes || '') : { sentiment: 'neutral' as const };

    return calculateReflectionQuality(
      chipCount,
      uniqueChipTypes,
      customNotesLength,
      hasVulnerabilityChips,
      themes.sentiment
    );
  }, [value.chips, value.customNotes]);

  // Update next chip type when chips change
  useEffect(() => {
    const selectedTypes = (value.chips || []).map(chip => {
      const storyChip = STORY_CHIPS.find(s => s.id === chip.chipId);
      return storyChip?.type;
    }).filter((type): type is ChipType => type !== undefined);

    const next = getNextChipType(selectedTypes);
    setNextChipType(next);
  }, [value.chips]);

  // Load pattern insights when chips change (friend-specific)
  useEffect(() => {
    if (!friendId) {
      setPatternInsights([]);
      return;
    }

    const loadInsights = async () => {
      const selectedChipIds = (value.chips || []).map(chip => chip.chipId);
      try {
        const insights = await generatePatternInsights(friendId, selectedChipIds);
        setPatternInsights(insights);
      } catch (error) {
        console.error('Error loading pattern insights:', error);
        setPatternInsights([]);
      }
    };

    loadInsights();
  }, [friendId, value.chips]);

  const handleChipSelect = (storyChip: StoryChip) => {
    // Add new chip to the array
    const newChip = {
      chipId: storyChip.id,
      componentOverrides: {},
    };

    onChange({
      ...value,
      chips: [...(value.chips || []), newChip],
    });
  };

  const handleComponentChange = (chipIndex: number, componentId: string, componentValue: string) => {
    const updatedChips = [...(value.chips || [])];
    updatedChips[chipIndex] = {
      ...updatedChips[chipIndex],
      componentOverrides: {
        ...updatedChips[chipIndex].componentOverrides,
        [componentId]: componentValue,
      },
    };

    onChange({
      ...value,
      chips: updatedChips,
    });
  };

  const handleRemoveChip = (chipIndex: number) => {
    const updatedChips = [...(value.chips || [])];
    updatedChips.splice(chipIndex, 1);

    onChange({
      ...value,
      chips: updatedChips,
    });
  };

  const handleCustomTextChange = (text: string) => {
    onChange({
      ...value,
      customNotes: text,
    });
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      {/* Reflection quality indicator */}
      {reflectionQuality.score > 0 && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.qualityBadge}>
          <Text style={styles.qualityText}>
            {reflectionQuality.emoji} {reflectionQuality.label}
          </Text>
        </Animated.View>
      )}

      {/* Contextual prompt based on user's text */}
      {contextualPrompt && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.promptContainer}>
          <Text style={[styles.promptText, { color: colors.foreground }]}>
            {contextualPrompt}
          </Text>
        </Animated.View>
      )}

      {/* Pattern insights (friend-specific) */}
      {patternInsights.length > 0 && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.insightsContainer}>
          {patternInsights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <Text style={[styles.insightText, { color: colors['muted-foreground'] }]}>
                {insight.message}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Show story chips for next type */}
      {nextChipType && (
        <ReflectionStoryChips
          chipType={nextChipType}
          category={category}
          archetype={archetype}
          vibe={vibe}
          tier={tier}
          interactionCount={interactionCount}
          daysSinceLastInteraction={daysSinceLastInteraction}
          userText={value.customNotes}
          onChipSelect={handleChipSelect}
        />
      )}

      {/* Text input with multiple chip bubbles inside */}
      <ReflectionTextInput
        chips={value.chips || []}
        customText={value.customNotes || ''}
        onComponentChange={handleComponentChange}
        onCustomTextChange={handleCustomTextChange}
        onRemoveChip={handleRemoveChip}
        placeholder="Add your own notes..."
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  qualityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)', // Subtle green tint
  },
  qualityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  promptContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(147, 51, 234, 0.08)', // Subtle purple tint
  },
  promptText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  insightsContainer: {
    gap: 8,
  },
  insightItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.08)', // Subtle blue tint
  },
  insightText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
