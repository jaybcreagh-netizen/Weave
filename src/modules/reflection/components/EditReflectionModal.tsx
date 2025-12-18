import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ContextualReflectionInput } from './ContextualReflectionInput';

import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { type Interaction } from '@/modules/interactions';
import { type StructuredReflection, type InteractionCategory, type Archetype, type Vibe } from '@/shared/types/legacy-types';
import { calculateDeepeningLevel } from '@/modules/intelligence';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';

import { MoonPhaseSelector } from '@/modules/intelligence';

interface EditReflectionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, reflection: StructuredReflection, vibe?: Vibe | null) => Promise<void>;
  friendArchetype?: Archetype;
}

export function EditReflectionModal({
  interaction,
  isOpen,
  onClose,
  onSave,
  friendArchetype,
}: EditReflectionModalProps) {
  const { colors } = useTheme();
  const [reflection, setReflection] = useState<StructuredReflection>(interaction?.reflection || {});
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(interaction?.vibe as Vibe | null);
  const [isSaving, setIsSaving] = useState(false);

  // Update reflection when interaction changes
  React.useEffect(() => {
    if (interaction) {
      setReflection(interaction.reflection || {});
      setSelectedVibe(interaction.vibe as Vibe | null);
    }
  }, [interaction]);

  const handleSave = async () => {
    if (!interaction) return;

    setIsSaving(true);
    try {
      await onSave(interaction.id, reflection, selectedVibe);

      // Close modal after save
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSaving(false);
    }
  };

  if (!interaction) return null;

  const category = (interaction.interactionCategory || interaction.activity) as InteractionCategory;
  const deepeningMetrics = calculateDeepeningLevel(reflection);

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      height="full"
      title="Tell me more"
      scrollable
      footerComponent={
        <Button
          label={isSaving ? 'Saving...' : 'Save Reflection'}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          fullWidth
          variant="primary"
        />
      }
    >


      <Animated.View entering={FadeIn.duration(300)} className="px-5 pb-5">
        <View className="mb-6">
          <Text variant="h3" className="mb-4">
            How did it feel?
          </Text>
          <MoonPhaseSelector
            selectedVibe={selectedVibe}
            onSelect={setSelectedVibe}
          />
        </View>

        <ContextualReflectionInput
          category={category}
          archetype={friendArchetype}
          vibe={selectedVibe}
          value={reflection}
          onChange={setReflection}
          useBottomSheetInput={true}
        />
      </Animated.View>
    </StandardBottomSheet>
  );
}
