import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
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
    <View>
      {/* Combined container - chip bubbles + text input together */}
      <View
        className="border-[1.5px] rounded-2xl p-3 min-h-[80px] shadow-sm elevation-2"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        {/* Multiple chip bubbles */}
        {chips.map((chip, chipIndex) => {
          const chipParts = parseChipParts(chip);

          return (
            <Animated.View
              key={chipIndex}
              entering={FadeIn.duration(300)}
              className="flex-row items-center py-1.5 pl-2.5 pr-1.5 rounded-xl border mb-2"
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
              }}
            >
              {/* Chip text with tappable components */}
              <View className="flex-1">
                <Text className="text-[14px] leading-[20px]" style={{ color: colors.foreground }}>
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
                        className="font-semibold"
                        style={{ color: colors.primary }}
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
                className="p-1 ml-1"
                onPress={() => onRemoveChip(chipIndex)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={14} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Text input for additional notes */}
        <InputComponent
          className="text-[15px] leading-6 min-h-[40px] p-0"
          style={{
            color: colors.foreground,
            textAlignVertical: 'top'
          }}
          placeholder={chips.length > 0 ? 'Add more details...' : placeholder}
          placeholderTextColor={colors['muted-foreground']}
          value={customText}
          onChangeText={onCustomTextChange}
          multiline
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
          <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-center items-center">
            <TouchableOpacity
              className="absolute inset-0"
              activeOpacity={1}
              onPress={() => setEditingChip(null)}
            >
              <View className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} />
            </TouchableOpacity>

            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              className="w-[80%] max-w-[400px] gap-3 pb-20"
            >
              <Text className="text-lg font-semibold text-center mb-3 text-white">Choose alternative</Text>

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
                        className="py-[18px] px-6 rounded-3xl border-0 shadow-sm elevation-3"
                        style={{
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 12,
                        }}
                        onPress={() => {
                          onComponentChange(editingChip.chipIndex, editingChip.componentId, option);
                          setEditingChip(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-base text-center tracking-[0.3px]"
                          style={{
                            color: isSelected ? colors['primary-foreground'] : colors.foreground,
                            fontWeight: isSelected ? '600' : '500',
                          }}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                });
              })()}

              <TouchableOpacity
                className="w-[60px] h-[60px] rounded-[30px] bg-white justify-center items-center self-center mt-5 shadow-lg elevation-6"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
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
