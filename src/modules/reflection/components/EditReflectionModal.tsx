import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sparkles, MessageCircle } from 'lucide-react-native';
import { ContextualReflectionInput } from './ContextualReflectionInput';
import * as Haptics from 'expo-haptics';
import { ReflectionAssistant } from '@/modules/journal/services/reflection-assistant.service'; // Import service
import { ActivityIndicator } from 'react-native';

import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { type Interaction } from '@/modules/interactions';
import { type StructuredReflection, type InteractionCategory, type Archetype, type Vibe } from '@/shared/types/legacy-types';
import { calculateDeepeningLevel } from '@/modules/intelligence/services/deepening.service';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { GuidedReflectionSheet } from '@/modules/journal/components/GuidedReflection/GuidedReflectionSheet';

import { MoonPhaseSelector } from '@/modules/intelligence/components/MoonPhaseSelector';

interface EditReflectionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, reflection: StructuredReflection, vibe?: Vibe | null) => Promise<void>;
  friendArchetype?: Archetype;
  friendName?: string;
  friendId?: string;
}

export function EditReflectionModal({
  interaction,
  isOpen,
  onClose,
  onSave,
  friendArchetype,
  friendName,
  friendId,
}: EditReflectionModalProps) {
  const { colors } = useTheme();
  const [reflection, setReflection] = useState<StructuredReflection>(interaction?.reflection || {});
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(interaction?.vibe as Vibe | null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false); // New state
  const [showGuidedReflection, setShowGuidedReflection] = useState(false);

  // Track which interaction we've initialized to prevent resetting state on re-renders
  const [initializedForId, setInitializedForId] = React.useState<string | null>(null);

  // Update reflection when interaction changes - only initialize once per modal open
  React.useEffect(() => {
    // Only initialize when modal opens with a new interaction
    if (interaction && isOpen && initializedForId !== interaction.id) {
      setInitializedForId(interaction.id);
      setReflection(interaction.reflection || {});
      setSelectedVibe(interaction.vibe as Vibe | null);
    }

    // Reset initialization tracking when modal closes
    if (!isOpen) {
      setInitializedForId(null);
    }
  }, [interaction, isOpen, initializedForId]);

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

  const handleAutoDraft = async () => {
    if (!interaction) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDrafting(true);
    try {
      const activity = interaction.activity || interaction.interactionCategory || 'hanging out';
      const draft = await ReflectionAssistant.generateInteractionDraft(
        friendName || 'friend',
        activity,
        selectedVibe
      );

      setReflection(prev => ({ ...prev, customNotes: draft }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to generate draft:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDrafting(false);
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

        {/* Help me write options */}
        {!reflection.customNotes && (
          <View className="flex-row items-center justify-center gap-4 mt-4">
            {/* Auto-write Button */}
            <TouchableOpacity
              onPress={handleAutoDraft}
              disabled={isDrafting}
              className="flex-row items-center gap-2 px-4 py-2.5 rounded-full border"
              style={{
                backgroundColor: 'transparent',
                borderColor: colors.primary + '40', // 40 = 25% opacity
              }}
            >
              {isDrafting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Sparkles size={16} color={colors.primary} />
              )}
              <Text variant="caption" className="font-semibold text-primary">
                {isDrafting ? 'Writing...' : 'Auto-draft'}
              </Text>
            </TouchableOpacity>

            {/* Guided Reflection Button */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGuidedReflection(true);
              }}
              className="flex-row items-center gap-2 px-4 py-2.5 rounded-full border"
              style={{
                backgroundColor: 'transparent',
                borderColor: colors.secondary + '40',
              }}
            >
              <MessageCircle size={16} color={colors.secondary} />
              <Text variant="caption" className="font-semibold" style={{ color: colors.secondary }}>
                Guided Chat
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Oracle Help me write */}
      <GuidedReflectionSheet
        isOpen={showGuidedReflection}
        onClose={() => setShowGuidedReflection(false)}
        context={friendId ? {
          type: 'post_weave',
          friendIds: [friendId],
          friendNames: friendName ? [friendName] : [],
          interactionId: interaction?.id,
          activity: interaction?.activity || interaction?.interactionCategory || undefined,
        } : undefined}
        onComplete={(content) => {
          setReflection({ ...reflection, customNotes: content });
          setShowGuidedReflection(false);
        }}
        onEscape={() => {
          setShowGuidedReflection(false);
        }}
      />
    </StandardBottomSheet>
  );
}
