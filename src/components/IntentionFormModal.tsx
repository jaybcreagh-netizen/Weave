import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { InteractionCategory } from './types';
import { getCategoryMetadata, INTERACTION_CATEGORIES } from '@/shared/constants/interaction-categories';

interface IntentionFormModalProps {
  isOpen: boolean;
  friendName: string;
  onClose: () => void;
  onSave: (description: string | undefined, category?: InteractionCategory) => Promise<void>;
}

/**
 * Form for creating a connection intention
 * Can be as vague ("want to connect") or specific ("coffee at that new place") as needed
 */
export function IntentionFormModal({
  isOpen,
  friendName,
  onClose,
  onSave,
}: IntentionFormModalProps) {
  const { colors } = useTheme();
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(description || undefined, selectedCategory);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDescription('');
      setSelectedCategory(undefined);
      onClose();
    } catch (error) {
      console.error('Error saving intention:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    setSelectedCategory(undefined);
    onClose();
  };

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={handleClose}
      height="full"
      title={`Set an Intention with ${friendName}`}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              What's the idea? (optional)
            </Text>
            <Text style={[styles.sectionHint, { color: colors['muted-foreground'] }]}>
              Can be vague or specific - whatever feels right
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                }
              ]}
              placeholder="e.g., grab coffee, catch up, go hiking..."
              placeholderTextColor={colors['muted-foreground']}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Activity type (optional)
            </Text>
            <View style={styles.categoryGrid}>
              {INTERACTION_CATEGORIES.map(category => {
                const metadata = getCategoryMetadata(category);
                const isSelected = selectedCategory === category;

                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => {
                      setSelectedCategory(isSelected ? undefined : category);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryIcon}>{metadata.icon}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isSelected ? colors['primary-foreground'] : colors.foreground }
                      ]}
                    >
                      {metadata.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={[styles.saveButtonText, { color: colors['primary-foreground'] }]}>
            {isSaving ? 'Saving...' : 'Set Intention'}
          </Text>
        </TouchableOpacity>
      </View>
    </StandardBottomSheet>
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
    fontFamily: 'Lora_700Bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    gap: 32,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
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
