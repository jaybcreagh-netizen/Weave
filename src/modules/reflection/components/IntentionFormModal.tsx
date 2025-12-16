import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  Phone,
  Utensils,
  Users,
  MessageCircle,
  Palette,
  PartyPopper,
  HeartHandshake,
  Star,
} from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { InteractionCategory } from '@/shared/types/common';

// Category definitions with Lucide icons
const INTENTION_CATEGORIES: Array<{
  value: InteractionCategory;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
    { value: 'text-call', label: 'Chat', icon: Phone, description: 'Call or video chat' },
    { value: 'meal-drink', label: 'Meal', icon: Utensils, description: 'Coffee, lunch, or dinner' },
    { value: 'hangout', label: 'Hangout', icon: Users, description: 'Casual time together' },
    { value: 'deep-talk', label: 'Deep Talk', icon: MessageCircle, description: 'Meaningful conversation' },
    { value: 'activity-hobby', label: 'Activity', icon: Palette, description: 'Sport, hobby, or adventure' },
    { value: 'event-party', label: 'Event', icon: PartyPopper, description: 'Party or social gathering' },
    { value: 'favor-support', label: 'Support', icon: HeartHandshake, description: 'Help or emotional support' },
    { value: 'celebration', label: 'Celebration', icon: Star, description: 'Special occasion' },
  ];

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
      snapPoints={['90%']}
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
          <Text className="font-lora-bold text-lg mb-1" style={{ color: colors.foreground }}>
            What's the idea?
          </Text>
          <Text className="font-inter-regular text-sm mb-4" style={{ color: colors['muted-foreground'] }}>
            Optional - can be vague or specific
          </Text>
          <TextInput
            placeholder="e.g., grab coffee, catch up, go hiking..."
            placeholderTextColor={colors['muted-foreground']}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            className="p-4 rounded-xl font-inter-regular text-base"
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.foreground,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Category Section */}
        <View>
          <Text className="font-lora-bold text-lg mb-1" style={{ color: colors.foreground }}>
            Activity type
          </Text>
          <Text className="font-inter-regular text-sm mb-4" style={{ color: colors['muted-foreground'] }}>
            Optional - what kind of connection?
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {INTENTION_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.value;
              const IconComponent = category.icon;

              return (
                <View
                  key={category.value}
                  style={{ width: '48%' }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategory(isSelected ? undefined : category.value);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                    className="p-4 rounded-2xl items-center justify-center"
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                      minHeight: 100,
                    }}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mb-2"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.background
                      }}
                    >
                      <IconComponent
                        size={20}
                        color={isSelected ? colors['primary-foreground'] : colors.primary}
                      />
                    </View>
                    <Text
                      className="font-inter-semibold text-sm text-center"
                      style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                    >
                      {category.label}
                    </Text>
                    <Text
                      className="font-inter-regular text-xs text-center mt-1"
                      style={{
                        color: isSelected
                          ? 'rgba(255,255,255,0.7)'
                          : colors['muted-foreground']
                      }}
                    >
                      {category.description}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </StandardBottomSheet>
  );
}
