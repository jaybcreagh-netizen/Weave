import React, { useEffect, useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ReflectionStoryChips } from './ReflectionStoryChips';
import { ReflectionTextInput } from './ReflectionTextInput';
import { getNextChipType, STORY_CHIPS, type StoryChip, type ChipType } from '@/modules/reflection';
import { type InteractionCategory, type Archetype, type Vibe, type Tier } from '@/shared/types/common';
import { type StructuredReflection } from '@/shared/types/legacy-types';
import { useTheme } from '@/shared/hooks/useTheme';
import { analyzeText, generateContextualPrompt, calculateReflectionQuality } from '@/modules/reflection';
import { STORY_CHIPS as ALL_STORY_CHIPS } from '@/modules/reflection';
import { generatePatternInsights, type PatternInsight } from '@/modules/reflection';

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
  useBottomSheetInput?: boolean;
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
  useBottomSheetInput,
}: ContextualReflectionInputProps) {
  const { colors } = useTheme();
  const [nextChipType, setNextChipType] = useState<ChipType | null>('activity');
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([]);
  const [debouncedCustomNotes, setDebouncedCustomNotes] = useState(value.customNotes || '');

  // Debounce custom notes to prevent heavy analysis on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCustomNotes(value.customNotes || '');
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [value.customNotes]);

  // Generate contextual prompt based on user's text
  const contextualPrompt = useMemo(() => {
    if (!debouncedCustomNotes || debouncedCustomNotes.trim().length === 0) {
      return null;
    }
    const themes = analyzeText(debouncedCustomNotes);
    return generateContextualPrompt(themes);
  }, [debouncedCustomNotes]);

  // Calculate reflection quality
  const reflectionQuality = useMemo(() => {
    const chipCount = (value.chips || []).length;
    const uniqueChipTypes = new Set(
      (value.chips || []).map(chip => {
        const storyChip = ALL_STORY_CHIPS.find(s => s.id === chip.chipId);
        return storyChip?.type;
      }).filter(Boolean)
    ).size;

    const customNotesLength = (debouncedCustomNotes || '').trim().length;

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

    const themes = customNotesLength > 0 ? analyzeText(debouncedCustomNotes || '') : { sentiment: 'neutral' as const };

    return calculateReflectionQuality(
      chipCount,
      uniqueChipTypes,
      customNotesLength,
      hasVulnerabilityChips,
      themes.sentiment
    );
  }, [value.chips, debouncedCustomNotes]);

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
    <Animated.View entering={FadeIn.duration(400)} className="gap-4">
      {/* Reflection quality indicator */}
      {reflectionQuality.score > 0 && (
        <Animated.View
          entering={FadeIn.duration(300)}
          className="self-start py-1.5 px-3 rounded-2xl bg-green-500/10"
        >
          <Text className="text-[13px] font-semibold text-green-500">
            {reflectionQuality.emoji} {reflectionQuality.label}
          </Text>
        </Animated.View>
      )}

      {/* Contextual prompt based on user's text */}
      {!!contextualPrompt && (
        <Animated.View
          entering={FadeIn.duration(300)}
          className="py-2 px-3 rounded-xl bg-purple-500/10"
        >
          <Text className="text-[15px] font-medium leading-[22px]" style={{ color: colors.foreground }}>
            {contextualPrompt}
          </Text>
        </Animated.View>
      )}

      {/* Pattern insights (friend-specific) */}
      {patternInsights.length > 0 && (
        <Animated.View entering={FadeIn.duration(300)} className="gap-2">
          {patternInsights.map((insight, index) => (
            <View key={index} className="py-1.5 px-2.5 rounded-lg bg-blue-500/10">
              <Text className="text-[13px] font-medium leading-[18px]" style={{ color: colors['muted-foreground'] }}>
                {insight.message}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Show story chips for next type */}
      {!!nextChipType && (
        <ReflectionStoryChips
          chipType={nextChipType}
          category={category}
          archetype={archetype}
          vibe={vibe}
          tier={tier}
          interactionCount={interactionCount}
          daysSinceLastInteraction={daysSinceLastInteraction}
          interactionCount={interactionCount}
          daysSinceLastInteraction={daysSinceLastInteraction}
          userText={debouncedCustomNotes}
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
        useBottomSheetInput={useBottomSheetInput}
      />
    </Animated.View>
  );
}
