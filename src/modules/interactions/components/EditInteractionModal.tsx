import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { X, CalendarDays, Check } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { type Interaction, type InteractionCategory, type Vibe, type StructuredReflection } from '../types';
import { getAllCategories, getCategoryMetadata, type CategoryMetadata } from '@/shared/constants/interaction-categories';
import { MoonPhaseSelector } from '@/modules/intelligence';
import { FriendSelector } from '@/modules/relationships';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { format } from 'date-fns';
import { BlurView } from 'expo-blur';
import { ReciprocitySelector, InitiatorType } from '@/modules/relationships';

interface EditInteractionModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (interactionId: string, updates: {
    title?: string;
    category?: InteractionCategory;
    interactionCategory?: InteractionCategory;
    activity?: string;
    interactionType?: string;
    vibe?: Vibe | null;
    reflection?: StructuredReflection;
    reflectionJSON?: string;
    interactionDate?: Date;
    initiator?: InitiatorType;
    note?: string;
  }) => Promise<void>;
}

const categories: CategoryMetadata[] = getAllCategories().map(cat => getCategoryMetadata(cat));

export function EditInteractionModal({
  interaction,
  isOpen,
  onClose,
  onSave,
}: EditInteractionModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [initiator, setInitiator] = useState<InitiatorType | undefined>(undefined);

  // Update state when interaction changes
  React.useEffect(() => {
    if (interaction) {
      setTitle(interaction.title || '');
      setSelectedCategory((interaction.interactionCategory || interaction.activity) as InteractionCategory);
      setSelectedVibe(interaction.vibe || null);
      setCustomNotes(interaction.reflection?.customNotes || interaction.note || '');
      setSelectedDate(interaction.interactionDate);
      setInitiator(interaction.initiator as InitiatorType | undefined);
    }
  }, [interaction]);

  const handleSave = async () => {
    if (!interaction) return;

    setIsSaving(true);
    try {
      const updates: any = {};

      if (title !== interaction.title) {
        updates.title = title;
      }

      if (selectedCategory && selectedCategory !== (interaction.interactionCategory || interaction.activity)) {
        updates.interactionCategory = selectedCategory;
        updates.activity = selectedCategory;
        const metadata = getCategoryMetadata(selectedCategory);
        updates.interactionType = metadata.label;
      }

      if (selectedVibe !== interaction.vibe) {
        updates.vibe = selectedVibe;
      }

      // Update reflection if custom notes changed
      if (customNotes !== (interaction.reflection?.customNotes || interaction.note || '')) {
        const newReflection = {
          ...interaction.reflection,
          customNotes,
        };
        updates.reflectionJSON = JSON.stringify(newReflection);
        updates.note = customNotes;
      }

      if (selectedDate && selectedDate.getTime() !== interaction.interactionDate.getTime()) {
        updates.interactionDate = selectedDate;
      }

      if (initiator !== interaction.initiator) {
        updates.initiator = initiator;
      }

      await onSave(interaction.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating interaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate dirty state
  const isDirty = React.useMemo(() => {
    if (!interaction) return false;

    const initialTitle = interaction.title || '';
    const initialCategory = (interaction.interactionCategory || interaction.activity) as InteractionCategory;
    const initialVibe = interaction.vibe || null;
    const initialNotes = interaction.reflection?.customNotes || interaction.note || '';
    // Handle potential string dates if data isn't perfectly typed at runtime, though types say Date.
    const initialDate = interaction.interactionDate instanceof Date ? interaction.interactionDate.getTime() : new Date(interaction.interactionDate).getTime();
    const initialInitiator = interaction.initiator as InitiatorType | undefined;

    // Current date comparison
    const currentDate = selectedDate ? selectedDate.getTime() : 0;

    return (
      title !== initialTitle ||
      selectedCategory !== initialCategory ||
      selectedVibe !== initialVibe ||
      customNotes !== initialNotes ||
      currentDate !== initialDate ||
      initiator !== initialInitiator
    );
  }, [interaction, title, selectedCategory, selectedVibe, customNotes, selectedDate, initiator]);

  const footerComponent = React.useMemo(() => (
    <Button
      label="Save Changes"
      onPress={handleSave}
      loading={isSaving}
      disabled={isSaving || !selectedCategory}
      fullWidth
      variant="primary"
    />
  ), [isSaving, selectedCategory, handleSave]);

  if (!interaction) return null;

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      hasUnsavedChanges={isDirty}
      height="full"
      title="Edit Weave"
      scrollable
      footerComponent={footerComponent}
    >
      <View className="px-5 pb-10 gap-8">
        {/* Title Input */}
        <View>
          <Input
            label="Title"
            placeholder='e.g., "Coffee at Blue Bottle"'
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Date Selection */}
        <View>
          <Text variant="label" className="mb-2" style={{ color: colors.foreground }}>
            Date
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3 p-4 border rounded-xl" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <CalendarDays size={20} color={colors.primary} />
              <Text variant="body">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select date'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Category Selection */}
        <View>
          <Text variant="label" className="mb-3" style={{ color: colors.foreground }}>
            Category
          </Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Animated.View
                  key={cat.id}
                  className="w-[48%]"
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                    className={`p-3 rounded-2xl border items-center justify-center min-h-[120px] ${isSelected ? 'border-2' : 'border'}`}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <Text className="text-3xl mb-2">{cat.icon}</Text>
                    <Text variant="body" weight="semibold" className="text-center mb-1">
                      {cat.label}
                    </Text>
                    <Text variant="caption" color="muted" className="text-center text-xs">
                      {cat.description}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {/* Vibe Selection */}
        <View>
          <Text variant="label" className="mb-3" style={{ color: colors.foreground }}>
            Vibe
          </Text>
          <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
        </View>

        {/* Reciprocity Section */}
        <View>
          <Text variant="label" className="mb-3" style={{ color: colors.foreground }}>
            Who initiated?
          </Text>
          <ReciprocitySelector
            value={initiator}
            onChange={setInitiator}
            hideLabel
          />
        </View>

        {/* Notes */}
        <View>
          <Input
            label="Notes"
            placeholder="Add notes about this moment..."
            value={customNotes}
            onChangeText={setCustomNotes}
            multiline
            numberOfLines={4}
            style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }}
          />
        </View>
      </View>

      {/* Calendar Modal - Keeping legacy simple modal for date picker to avoid nesting sheets complexities, but styled with NativeWind */}
      {showDatePicker && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              className="flex-1 justify-center items-center p-5"
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <Animated.View
                entering={FadeInUp.duration(200).springify()}
                className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
                style={{
                  backgroundColor: isDarkMode ? colors.background + 'F5' : colors.background + 'F8',
                }}
                onStartShouldSetResponder={() => true}
              >
                <View className="flex-row justify-between items-center mb-4">
                  <Text variant="h3" weight="bold">
                    Pick a Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2 -mr-2">
                    <X color={colors['muted-foreground']} size={22} />
                  </TouchableOpacity>
                </View>

                <CustomCalendar
                  selectedDate={selectedDate || new Date()}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setShowDatePicker(false);
                  }}
                />
              </Animated.View>
            </TouchableOpacity>
          </BlurView>
        </Modal>
      )}
    </StandardBottomSheet>
  );
}
