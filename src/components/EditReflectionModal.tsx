import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ContextualReflectionInput } from './ContextualReflectionInput';
import { CelebrationAnimation } from './CelebrationAnimation';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Interaction, type StructuredReflection, type InteractionCategory, type Archetype, type Vibe } from './types';
import { calculateDeepeningLevel } from '@/modules/intelligence';

interface EditReflectionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, reflection: StructuredReflection) => Promise<void>;
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
  const [reflection, setReflection] = useState<StructuredReflection>(
    interaction?.reflection || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Update reflection when interaction changes
  React.useEffect(() => {
    if (interaction) {
      setReflection(interaction.reflection || {});
    }
  }, [interaction]);

  const handleSave = async () => {
    if (!interaction) return;

    setIsSaving(true);
    try {
      await onSave(interaction.id, reflection);

      // Show celebration animation
      setShowCelebration(true);

      // Close modal after animation
      setTimeout(() => {
        onClose();
        setShowCelebration(false);
      }, 900);
    } catch (error) {
      console.error('Error saving reflection:', error);
      setIsSaving(false);
    }
  };

  if (!interaction) return null;

  const category = (interaction.interactionCategory || interaction.activity) as InteractionCategory;
  const deepeningMetrics = calculateDeepeningLevel(reflection);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Celebration animation */}
        <CelebrationAnimation
          visible={showCelebration}
          intensity={deepeningMetrics.level === 'none' ? 'light' : deepeningMetrics.level}
          onComplete={() => setShowCelebration(false)}
        />
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {reflection.chips?.length ? 'Edit Reflection' : 'Deepen this weave'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors['muted-foreground'] }]}>
              Add depth to this moment
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color={colors['muted-foreground']} size={24} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeIn.duration(300)}>
              <ContextualReflectionInput
                category={category}
                archetype={friendArchetype}
                vibe={interaction.vibe as Vibe}
                value={reflection}
                onChange={setReflection}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
              {isSaving ? 'Saving...' : 'Save Reflection'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
