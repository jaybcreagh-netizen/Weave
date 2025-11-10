import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { type ChipType, getChipTypeLabel } from '../lib/story-chips';
import { createNewCustomChip } from '../lib/adaptive-chips';

interface CustomChipModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedText?: string;
  suggestedType?: ChipType;
  onChipCreated?: (chipId: string) => void;
}

const CHIP_TYPES: ChipType[] = ['activity', 'setting', 'people', 'dynamic', 'topic', 'feeling', 'moment', 'surprise'];

/**
 * Modal for creating custom story chips
 */
export function CustomChipModal({
  isOpen,
  onClose,
  suggestedText,
  suggestedType,
  onChipCreated,
}: CustomChipModalProps) {
  const { colors } = useTheme();
  const [chipText, setChipText] = useState(suggestedText || '');
  const [selectedType, setSelectedType] = useState<ChipType>(suggestedType || 'feeling');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!chipText.trim()) return;

    setIsCreating(true);
    try {
      const chip = await createNewCustomChip(chipText.trim(), selectedType);
      onChipCreated?.(chip.chipId);
      setChipText('');
      setSelectedType('feeling');
      onClose();
    } catch (error) {
      console.error('Error creating custom chip:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Create Custom Chip
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Suggestion hint */}
            {suggestedText && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.suggestionLabel, { color: colors['muted-foreground'] }]}>
                  Suggested based on your patterns:
                </Text>
                <Text style={[styles.suggestionText, { color: colors.foreground }]}>
                  "{suggestedText}"
                </Text>
              </View>
            )}

            {/* Chip text input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors['muted-foreground'] }]}>
                Chip text
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                value={chipText}
                onChangeText={setChipText}
                placeholder="e.g., talked about our favorite memories"
                placeholderTextColor={colors['muted-foreground']}
                multiline
                maxLength={100}
              />
              <Text style={[styles.hint, { color: colors['muted-foreground'] }]}>
                {chipText.length}/100 characters
              </Text>
            </View>

            {/* Chip type selector */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors['muted-foreground'] }]}>
                What type of chip is this?
              </Text>
              <View style={styles.typeGrid}>
                {CHIP_TYPES.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: selectedType === type ? colors.primary : colors.card,
                        borderColor: selectedType === type ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        {
                          color: selectedType === type ? 'white' : colors.foreground,
                        },
                      ]}
                    >
                      {type}
                    </Text>
                    <Text
                      style={[
                        styles.typeChipLabel,
                        {
                          color: selectedType === type ? 'rgba(255,255,255,0.8)' : colors['muted-foreground'],
                        },
                      ]}
                    >
                      {getChipTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors['muted-foreground'] }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: chipText.trim() ? colors.primary : colors.muted },
              ]}
              onPress={handleCreate}
              disabled={!chipText.trim() || isCreating}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? 'Creating...' : 'Create Chip'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
  },
  suggestionBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: '48%',
    flexBasis: '48%',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  typeChipLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
