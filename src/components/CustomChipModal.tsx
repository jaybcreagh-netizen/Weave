import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { type ChipType, getChipTypeLabel } from '@/modules/reflection';
import { createNewCustomChip } from '@/modules/reflection';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';

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
    <AnimatedBottomSheet
      visible={isOpen}
      onClose={onClose}
      height="form"
    >
      <View className="px-5 pb-5">
        {/* Header */}
        <View className="flex-row items-center justify-between py-4 pb-4">
          <Text variant="h3" weight="bold">
            Create Custom Chip
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Suggestion hint */}
          {suggestedText && (
            <View
              className="p-4 rounded-xl border mb-6"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
            >
              <Text variant="label" className="mb-1" style={{ color: colors['muted-foreground'] }}>
                Suggested based on your patterns:
              </Text>
              <Text weight="semibold">
                "{suggestedText}"
              </Text>
            </View>
          )}

          {/* Chip text input */}
          <View className="mb-6">
            <Input
              label="Chip text"
              value={chipText}
              onChangeText={setChipText}
              placeholder="e.g., talked about our favorite memories"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <Text variant="caption" className="mt-1 text-right" style={{ color: colors['muted-foreground'] }}>
              {chipText.length}/100 characters
            </Text>
          </View>

          {/* Chip type selector */}
          <View className="mb-6">
            <Text variant="label" className="mb-2" style={{ color: colors['muted-foreground'] }}>
              What type of chip is this?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CHIP_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  className="w-[48%] p-3 rounded-xl border-2"
                  style={{
                    backgroundColor: selectedType === type ? colors.primary : colors.card,
                    borderColor: selectedType === type ? colors.primary : colors.border,
                  }}
                  onPress={() => setSelectedType(type)}
                >
                  <Text
                    weight="semibold"
                    className="mb-0.5 capitalize"
                    style={{
                      color: selectedType === type ? 'white' : colors.foreground,
                    }}
                  >
                    {type}
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      color: selectedType === type ? 'rgba(255,255,255,0.8)' : colors['muted-foreground'],
                    }}
                  >
                    {getChipTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="flex-row gap-3 pt-5 border-t" style={{ borderTopColor: colors.border }}>
          <Button
            label="Cancel"
            onPress={onClose}
            variant="outline"
            className="flex-1"
          />
          <Button
            label={isCreating ? 'Creating...' : 'Create Chip'}
            onPress={handleCreate}
            disabled={!chipText.trim() || isCreating}
            loading={isCreating}
            variant="primary"
            className="flex-1"
          />
        </View>
      </View>
    </AnimatedBottomSheet>
  );
}
