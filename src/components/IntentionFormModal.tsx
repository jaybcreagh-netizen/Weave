import React, { useState } from 'react';
import { View, TouchableOpacity, } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
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
      scrollable
      footerComponent={
        <Button
          label={isSaving ? 'Saving...' : 'Set Intention'}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          fullWidth
          variant="primary"
        />
      }
    >
      <View className="flex-1 px-5 pb-10 gap-8">
        {/* Description Section */}
        <View>
          <Text variant="label" className="mb-1" style={{ color: colors.foreground }}>
            What's the idea? (optional)
          </Text>
          <Text variant="caption" className="mb-3" style={{ color: colors['muted-foreground'] }}>
            Can be vague or specific - whatever feels right
          </Text>
          <Input
            placeholder="e.g., grab coffee, catch up, go hiking..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }}
          />
        </View>

        {/* Category Section */}
        <View>
          <Text variant="label" className="mb-3" style={{ color: colors.foreground }}>
            Activity type (optional)
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {INTERACTION_CATEGORIES.map(category => {
              const metadata = getCategoryMetadata(category);
              const isSelected = selectedCategory === category;

              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => {
                    setSelectedCategory(isSelected ? undefined : category);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                  className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border ${isSelected ? 'border-primary bg-primary' : 'border-border bg-card'}`}
                  style={isSelected ? { borderColor: colors.primary } : { borderColor: colors.border, backgroundColor: colors.card }}
                >
                  <Text className="text-xl">{metadata.icon}</Text>
                  <Text
                    variant="button"
                    style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                  >
                    {metadata.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </StandardBottomSheet>
  );
}
