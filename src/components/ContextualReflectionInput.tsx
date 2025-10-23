import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ReflectionStoryChips } from './ReflectionStoryChips';
import { ReflectionTextInput } from './ReflectionTextInput';
import { getNextChipType, STORY_CHIPS, type StoryChip, type ChipType } from '../lib/story-chips';
import { type InteractionCategory, type Archetype, type Vibe } from './types';
import { type StructuredReflection } from '../stores/interactionStore';
import { useTheme } from '../hooks/useTheme';

interface ContextualReflectionInputProps {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  value: StructuredReflection;
  onChange: (reflection: StructuredReflection) => void;
}

/**
 * Story builder reflection input
 *
 * Flow:
 * 1. Show next chip type in sequence (activity → people → topic → feeling → moment)
 * 2. User taps chip → appears as bubble card in text input
 * 3. User can tap colored words in bubble to customize
 * 4. Next chip type appears automatically
 * 5. User can type additional notes at any time
 * 6. Clean, aligned, beautiful
 */
export function ContextualReflectionInput({
  category,
  archetype,
  vibe,
  value,
  onChange,
}: ContextualReflectionInputProps) {
  const { colors } = useTheme();
  const [nextChipType, setNextChipType] = useState<ChipType | null>('activity');

  // Update next chip type when chips change
  useEffect(() => {
    const selectedTypes = (value.chips || []).map(chip => {
      const storyChip = STORY_CHIPS.find(s => s.id === chip.chipId);
      return storyChip?.type;
    }).filter((type): type is ChipType => type !== undefined);

    const next = getNextChipType(selectedTypes);
    setNextChipType(next);
  }, [value.chips]);

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
      {/* Show story chips for next type */}
      {nextChipType && (
        <ReflectionStoryChips
          chipType={nextChipType}
          category={category}
          archetype={archetype}
          vibe={vibe}
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
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
});
