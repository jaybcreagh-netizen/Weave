import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  X, Calendar, Briefcase, Package, Church, Baby, Feather, Hospital,
  GraduationCap, PartyPopper, Sparkles, type LucideIcon
} from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import LifeEventModel, { LifeEventType, LifeEventImportance } from '@/db/models/LifeEvent';
import { LifeEvent } from '@/shared/types/legacy-types';

import UserProgress from '@/db/models/UserProgress';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { startOfDay } from 'date-fns';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';

interface LifeEventModalProps {
  visible: boolean;
  onClose: () => void;
  friendId: string;
  existingEvent?: LifeEvent | null;
}

const EVENT_TYPES: Array<{ value: LifeEventType; label: string; icon: LucideIcon }> = [
  { value: 'new_job', label: 'New Job', icon: Briefcase },
  { value: 'moving', label: 'Moving/Relocating', icon: Package },
  { value: 'wedding', label: 'Wedding', icon: Church },
  { value: 'baby', label: 'New Baby/Pregnancy', icon: Baby },
  { value: 'loss', label: 'Loss/Grief', icon: Feather },
  { value: 'health_event', label: 'Health Event', icon: Hospital },
  { value: 'graduation', label: 'Graduation', icon: GraduationCap },
  { value: 'celebration', label: 'Milestone/Achievement', icon: PartyPopper },
  { value: 'other', label: 'Other', icon: Sparkles },
];

const IMPORTANCE_LEVELS: Array<{ value: LifeEventImportance; label: string; description: string }> = [
  { value: 'low', label: 'Light', description: 'A small moment' },
  { value: 'medium', label: 'Notable', description: 'Worth remembering' },
  { value: 'high', label: 'Significant', description: 'A major moment' },
  { value: 'critical', label: 'Special', description: 'A milestone to celebrate' },
];

export const LifeEventModal: React.FC<LifeEventModalProps> = ({
  visible,
  onClose,
  friendId,
  existingEvent,
}) => {
  const { colors, isDarkMode } = useTheme();
  const [eventType, setEventType] = useState<LifeEventType>(existingEvent?.eventType || 'other');
  const [eventDate, setEventDate] = useState<Date>(existingEvent?.date || startOfDay(new Date()));
  const [title, setTitle] = useState(existingEvent?.title || '');
  const [notes, setNotes] = useState(existingEvent?.description || '');
  const [importance, setImportance] = useState<LifeEventImportance>(existingEvent?.importance || 'medium');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (existingEvent) {
        setEventType(existingEvent.eventType);
        setEventDate(existingEvent.date || startOfDay(new Date()));
        setTitle(existingEvent.title);
        setNotes(existingEvent.description || '');
        setImportance(existingEvent.importance);
      } else {
        // Reset to defaults for new event
        setEventType('other');
        setEventDate(startOfDay(new Date()));
        setTitle('');
        setNotes('');
        setImportance('medium');
      }
    }
  }, [visible, existingEvent]);

  const handleDateSelect = (date: Date) => {
    setEventDate(startOfDay(date));
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await database.write(async () => {
        if (existingEvent) {
          // Update existing event
          const eventModel = await database.get<LifeEventModel>('life_events').find(existingEvent.id);
          await eventModel.update(event => {
            event.eventType = eventType;
            event.eventDate = startOfDay(eventDate);
            event.title = title.trim() || EVENT_TYPES.find(t => t.value === eventType)?.label || 'Life Event';
            event.notes = notes.trim();
            event.importance = importance;
          });
        } else {
          // Create new event
          await database.get<LifeEventModel>('life_events').create(event => {
            event.friendId = friendId;
            event.eventType = eventType;
            event.eventDate = startOfDay(eventDate);
            event.title = title.trim() || EVENT_TYPES.find(t => t.value === eventType)?.label || 'Life Event';
            event.notes = notes.trim();
            event.importance = importance;
            event.source = 'manual';
            event.isRecurring = false;
            event.reminded = false;
          });

          const userProgress = await database.get<UserProgress>('user_progress').query().fetch();
          const progress = userProgress[0];
          await progress.update(p => {
            p.scribeProgress += 1;
          });
        }
      });

      onClose();
    } catch (error) {
      console.error('Error saving life event:', error);
      Alert.alert('Error', 'Failed to save life event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEvent) return;

    Alert.alert(
      'Delete Life Event',
      'Are you sure you want to delete this life event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                const eventModel = await database.get<LifeEventModel>('life_events').find(existingEvent.id);
                await eventModel.destroyPermanently();
              });
              onClose();
            } catch (error) {
              console.error('Error deleting life event:', error);
              Alert.alert('Error', 'Failed to delete life event');
            }
          },
        },
      ]
    );
  };

  return (
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      height="full"
      title={existingEvent ? 'Edit Life Event' : 'Add Life Event'}
      scrollable
      footerComponent={
        <View className="flex-row gap-3">
          {existingEvent && (
            <TouchableOpacity
              onPress={handleDelete}
              className="flex-1 py-3 px-6 rounded-full items-center"
              style={{ backgroundColor: colors.destructive }}
            >
              <Text className="font-inter-semibold text-base text-white">Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 px-6 rounded-full items-center"
            style={{ backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }}
          >
            <Text className="font-inter-semibold text-base text-white">
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View className="flex-1">
        <View className="flex-1">
          {/* Event Type */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Event Type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => setEventType(type.value)}
                  className="px-4 py-3 rounded-xl flex-row items-center gap-2"
                  style={{
                    backgroundColor: eventType === type.value ? `${colors.primary}20` : colors.muted,
                    borderWidth: eventType === type.value ? 2 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <type.icon size={18} color={eventType === type.value ? colors.primary : colors.foreground} />
                  <Text
                    className="font-inter-medium text-sm"
                    style={{ color: eventType === type.value ? colors.primary : colors.foreground }}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Title */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Title (Optional)
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Starting at Tech Co (optional, defaults to event type)"
            placeholderTextColor={colors['muted-foreground']}
            className="p-4 rounded-xl mb-4 font-inter-regular text-base"
            style={{ backgroundColor: colors.muted, color: colors.foreground }}
          />

          {/* Date */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Date
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="p-4 rounded-xl mb-4 flex-row items-center gap-3"
            style={{ backgroundColor: colors.muted }}
          >
            <Calendar size={20} color={colors['muted-foreground']} />
            <Text className="font-inter-regular text-base flex-1" style={{ color: colors.foreground }}>
              {eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>



          {/* Importance */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Importance
          </Text>
          <View className="gap-2 mb-4">
            {IMPORTANCE_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                onPress={() => setImportance(level.value)}
                className="p-3 rounded-xl flex-row items-center justify-between"
                style={{
                  backgroundColor: importance === level.value ? `${colors.primary}20` : colors.muted,
                  borderWidth: importance === level.value ? 2 : 0,
                  borderColor: colors.primary,
                }}
              >
                <View>
                  <Text
                    className="font-inter-semibold text-sm"
                    style={{ color: importance === level.value ? colors.primary : colors.foreground }}
                  >
                    {level.label}
                  </Text>
                  <Text className="font-inter-regular text-xs" style={{ color: colors['muted-foreground'] }}>
                    {level.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Notes (Optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional details..."
            placeholderTextColor={colors['muted-foreground']}
            multiline
            numberOfLines={3}
            className="p-4 rounded-xl mb-6 font-inter-regular text-base"
            style={{ backgroundColor: colors.muted, color: colors.foreground, textAlignVertical: 'top' }}
          />

        </View>

        {/* Calendar Sheet */}
        <AnimatedBottomSheet
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          height="form"
        >
          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-4 px-6 pt-2">
              <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                Pick a Date
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2 -mr-2">
                <X size={22} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            <View className="px-4">
              <CustomCalendar
                selectedDate={eventDate}
                onDateSelect={handleDateSelect}
                minDate={undefined}
              />
            </View>
          </View>
        </AnimatedBottomSheet>
      </View>
    </AnimatedBottomSheet>
  );
};
