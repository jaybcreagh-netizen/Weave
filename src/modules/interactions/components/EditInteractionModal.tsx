import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, StyleSheet, Platform } from 'react-native';
import { X, CalendarDays, Check, Clock } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { BottomSheetInput } from '@/shared/ui/BottomSheetInput';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { InteractionShape } from '@/shared/types/derived';
import { type InteractionCategory, type Vibe, type StructuredReflection, type Interaction } from '../types';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { getAllCategories, getCategoryMetadata, type CategoryMetadata } from '@/shared/constants/interaction-categories';
import { MoonPhaseSelector } from '@/modules/intelligence/components/MoonPhaseSelector';
import { FriendSelector } from '@/modules/relationships/components/FriendSelector';
import { NotesInputField } from '@/shared/components/NotesInputField';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { format } from 'date-fns';
import { BlurView } from 'expo-blur';
import { ReciprocitySelector, InitiatorType } from '@/modules/relationships/components/ReciprocitySelector';

interface EditInteractionModalProps {
  interaction: InteractionModel | Interaction | InteractionShape | null;
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
    location?: string;
    friendIds?: string[];
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
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [initiator, setInitiator] = useState<InitiatorType | undefined>(undefined);
  const [location, setLocation] = useState('');

  // Participant State
  const [selectedFriends, setSelectedFriends] = useState<FriendModel[]>([]);
  const [isFriendSelectorVisible, setIsFriendSelectorVisible] = useState(false);
  const [initialFriendIds, setInitialFriendIds] = useState<string[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Track which interaction we've initialized to prevent resetting state on re-renders
  const [initializedForId, setInitializedForId] = React.useState<string | null>(null);



  // Update state when interaction changes - only initialize once per modal open
  React.useEffect(() => {
    // Only initialize when modal opens with a new interaction
    if (interaction && isOpen && initializedForId !== interaction.id) {
      setInitializedForId(interaction.id);
      setTitle(interaction.title || '');
      setSelectedCategory((interaction.interactionCategory || interaction.activity) as InteractionCategory);
      setSelectedVibe((interaction.vibe as Vibe) || null);
      setCustomNotes(interaction.reflection?.customNotes || interaction.note || '');
      setSelectedDate(interaction.interactionDate);
      setInitiator(interaction.initiator as InitiatorType | undefined);
      setLocation(interaction.location || '');

      // Fetch participants
      const fetchParticipants = async () => {
        setIsLoadingFriends(true);
        try {
          // Robust fetch that works for both Models and DTOs by querying the DB directly
          const interactionFriends = await database.get('interaction_friends')
            .query(Q.where('interaction_id', interaction.id))
            .fetch() as unknown as InteractionFriend[];

          const friendModels = await Promise.all(interactionFriends.map(join => join.friend.fetch()));
          const ids = friendModels.map(f => f.id);
          setInitialFriendIds(ids);
          setSelectedFriends(friendModels);
        } catch (error) {
          console.error('Error fetching interaction friends:', error);
        } finally {
          setIsLoadingFriends(false);
        }
      };

      fetchParticipants();
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

      const currentInteractionTime = interaction.interactionDate instanceof Date
        ? interaction.interactionDate.getTime()
        : new Date(interaction.interactionDate).getTime();

      if (selectedDate && selectedDate.getTime() !== currentInteractionTime) {
        updates.interactionDate = selectedDate;
      }

      if (initiator !== interaction.initiator) {
        updates.initiator = initiator;
      }

      if (location !== (interaction.location || '')) {
        updates.location = location;
      }

      // Check if participants changed
      const currentSelectedIds = selectedFriends.map(f => f.id);
      const added = currentSelectedIds.filter(id => !initialFriendIds.includes(id));
      const removed = initialFriendIds.filter(id => !currentSelectedIds.includes(id));

      if (added.length > 0 || removed.length > 0) {
        updates.friendIds = currentSelectedIds;
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
    const initialLocation = interaction.location || '';
    // Handle potential string dates if data isn't perfectly typed at runtime, though types say Date.
    // Handle potential string dates if data isn't perfectly typed at runtime, though types say Date.
    const initialDate = interaction.interactionDate instanceof Date ? interaction.interactionDate.getTime() : new Date(interaction.interactionDate).getTime();
    const initialInitiator = interaction.initiator as InitiatorType | undefined;

    // Current date comparison
    const currentDate = selectedDate ? selectedDate.getTime() : 0;

    // Friends comparison
    const currentSelectedIds = selectedFriends.map(f => f.id);
    const friendsChanged =
      currentSelectedIds.length !== initialFriendIds.length ||
      !currentSelectedIds.every(id => initialFriendIds.includes(id));

    return (
      title !== initialTitle ||
      selectedCategory !== initialCategory ||
      selectedVibe !== initialVibe ||
      customNotes !== initialNotes ||
      location !== initialLocation ||
      currentDate !== initialDate ||
      initiator !== initialInitiator ||
      friendsChanged
    );
  }, [interaction, title, selectedCategory, selectedVibe, customNotes, location, selectedDate, initiator, selectedFriends, initialFriendIds]);

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

        {/* Participants Selection */}
        <View>
          <TouchableOpacity
            onPress={() => setIsFriendSelectorVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }}
          >
            <Icon name="Users" size={20} color="#64748b" />
            <Text style={{ marginLeft: 8, fontSize: 16 }}>
              {selectedFriends.length > 0
                ? `${selectedFriends.length} Friends Selected`
                : 'Manage Participants'}
            </Text>
          </TouchableOpacity>
          <FriendSelector
            visible={isFriendSelectorVisible}
            onClose={() => setIsFriendSelectorVisible(false)}
            selectedFriends={selectedFriends}
            onSelectionChange={setSelectedFriends}
            asModal={true}
          />
        </View>

        {/* Title BottomSheetInput */}
        <View>
          <BottomSheetInput
            label="Title"
            placeholder='e.g., "Coffee at Blue Bottle"'
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Location BottomSheetInput */}
        <View>
          <BottomSheetInput
            label="Location"
            placeholder='e.g., "Blue Bottle Coffee, Hayes Valley"'
            value={location}
            onChangeText={setLocation}
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

        {/* Time Selection (for planned interactions) */}
        {interaction?.status === 'planned' && (
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text variant="label" style={{ color: colors.foreground }}>
                Time
              </Text>
              {selectedDate && (selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0) && (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedDate) {
                      const clearedDate = new Date(selectedDate);
                      clearedDate.setHours(0, 0, 0, 0);
                      setSelectedDate(clearedDate);
                    }
                  }}
                >
                  <Text variant="caption" style={{ color: colors.primary }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3 p-4 border rounded-xl" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <Clock size={20} color={colors.primary} />
                <Text variant="body" style={{ color: selectedDate && (selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0) ? colors.foreground : colors['muted-foreground'] }}>
                  {selectedDate && (selectedDate.getHours() !== 0 || selectedDate.getMinutes() !== 0)
                    ? format(selectedDate, 'h:mm a')
                    : 'Add a time (optional)'}
                </Text>
              </View>
            </TouchableOpacity>

            {showTimePicker && (
              <View className="mt-3">
                <DateTimePicker
                  value={selectedDate || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, time) => {
                    if (Platform.OS === 'android') {
                      setShowTimePicker(false);
                    }
                    if (time && event.type === 'set') {
                      const newDate = new Date(selectedDate || new Date());
                      newDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
                      setSelectedDate(newDate);
                    }
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(false)}
                    className="py-2 px-4 rounded-full items-center self-center mt-2"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text variant="body" weight="semibold" style={{ color: 'white' }}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

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
                    <View className="w-10 h-10 items-center justify-center mb-2">
                      <cat.iconComponent size={28} color={isSelected ? colors.primary : colors['muted-foreground']} />
                    </View>
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

        {/* Notes - Opens modal for focused editing */}
        <NotesInputField
          value={customNotes}
          onChangeText={setCustomNotes}
          label="Notes"
          placeholder="Add a note about this moment..."
        />
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
