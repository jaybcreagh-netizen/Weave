import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { STORY_CHIPS, type StoryChip } from '@/modules/reflection';
import { type ReflectionChip } from '@/shared/types/legacy-types';
import { useTheme } from '@/shared/hooks/useTheme';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

interface ReflectionTextInputProps {
  chips: ReflectionChip[];
  customText: string;
  onComponentChange: (chipIndex: number, componentId: string, value: string) => void;
  onCustomTextChange: (text: string) => void;
  onRemoveChip: (chipIndex: number) => void;
  placeholder?: string;
  useBottomSheetInput?: boolean;
}

/**
 * Text input that displays multiple sentence chips as inline bubble cards
 * User can tap colored words to customize, and type after chips
 */
export function ReflectionTextInput({
  chips,
  customText,
  onComponentChange,
  onCustomTextChange,
  onRemoveChip,
  placeholder = 'Or write your own...',
  useBottomSheetInput = false,
}: ReflectionTextInputProps) {
  const { colors } = useTheme();
  const [editingChip, setEditingChip] = useState<{ chipIndex: number; componentId: string } | null>(null);

  // Parse a chip's template to find tappable components
  const parseChipParts = (chip: ReflectionChip) => {
    // ... existing implementation ...
    const storyChip = STORY_CHIPS.find(s => s.id === chip.chipId);
    if (!storyChip) return [];

    const parts: Array<{ type: 'text' | 'component'; value: string; componentId?: string }> = [];
    const remaining = storyChip.template;
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(storyChip.template)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: remaining.substring(lastIndex, match.index),
        });
      }

      const componentId = match[1];
      const component = storyChip.components?.[componentId];
      if (!component) continue;

      const value = chip.componentOverrides[componentId] || component.original;

      parts.push({
        type: 'component',
        value,
        componentId,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < storyChip.template.length) {
      parts.push({
        type: 'text',
        value: remaining.substring(lastIndex),
      });
    }

    return parts;
  };

  const InputComponent = useBottomSheetInput ? BottomSheetTextInput : TextInput;

  return (
    <View style={styles.container}>
      {/* Combined container - chip bubbles + text input together */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Multiple chip bubbles */}
        {chips.map((chip, chipIndex) => {
          const chipParts = parseChipParts(chip);

          return (
            <Animated.View
              key={chipIndex}
              entering={FadeIn.duration(300)}
              style={[
                styles.chipBubble,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Chip text with tappable components */}
              <View style={styles.chipContent}>
                <Text style={[styles.chipText, { color: colors.foreground }]}>
                  {chipParts.map((part, partIndex) => {
                    if (part.type === 'text') {
                      return (
                        <Text key={partIndex}>
                          {part.value}
                        </Text>
                      );
                    }

                    return (
                      <Text
                        key={partIndex}
                        style={[styles.tappableText, { color: colors.primary }]}
                        onPress={() =>
                          setEditingChip({ chipIndex, componentId: part.componentId! })
                        }
                      >
                        {part.value}
                      </Text>
                    );
                  })}
                </Text>
              </View>

              {/* Remove chip button */}
              <TouchableOpacity
                style={styles.removeChip}
                onPress={() => onRemoveChip(chipIndex)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Text input for additional notes */}
        <InputComponent
          style={[
            styles.textInput,
            {
              color: colors.foreground,
            },
          ]}
          placeholder={chips.length > 0 ? 'Add more details...' : placeholder}
          placeholderTextColor={colors['muted-foreground']}
          value={customText}
          onChangeText={onCustomTextChange}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Component editor modal */}
      {editingChip && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={() => setEditingChip(null)}
        >
          <Animated.View entering={FadeIn.duration(200)} style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditingChip(null)}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
            </TouchableOpacity>

            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.bubbleMenu}
            >
              <Text style={styles.modalTitle}>Choose alternative</Text>

              {(() => {
                const chip = chips[editingChip.chipIndex];
                const storyChip = STORY_CHIPS.find(s => s.id === chip.chipId);
                if (!storyChip || !storyChip.components) return null;

                const component = storyChip.components[editingChip.componentId];
                if (!component) return null;

                const currentValue =
                  chip.componentOverrides[editingChip.componentId] || component.original;

                return [component.original, ...component.alternatives].map((option, index) => {
                  const isSelected = currentValue === option;

                  return (
                    <Animated.View
                      key={index}
                      entering={FadeInDown.duration(300).delay(index * 50)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.bubbleButton,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          onComponentChange(editingChip.chipIndex, editingChip.componentId, option);
                          setEditingChip(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            {
                              color: isSelected ? colors['primary-foreground'] : colors.foreground,
                              fontWeight: isSelected ? '600' : '500',
                            },
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                });
              })()}

              <TouchableOpacity
                style={styles.closeButtonCircle}
                onPress={() => setEditingChip(null)}
              >
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  inputContainer: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  chipContent: {
    flex: 1,
  },
  chipText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tappableText: {
    fontWeight: '600',
  },
  removeChip: {
    padding: 4,
    marginLeft: 8,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 40,
    padding: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleMenu: {
    width: '80%',
    maxWidth: 400,
    gap: 12,
    paddingBottom: 80,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: '#fff',
  },
  bubbleButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  bubbleText: {
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  closeButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
