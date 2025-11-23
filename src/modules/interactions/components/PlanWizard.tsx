import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { InteractionCategory } from '@/shared/constants/interaction-categories';
import { usePlanSuggestion } from '../hooks/usePlanSuggestion';
import { PlanWizardStep1 } from './plan-wizard/PlanWizardStep1';
import { PlanWizardStep2 } from './plan-wizard/PlanWizardStep2';
import { PlanWizardStep3 } from './plan-wizard/PlanWizardStep3';
import { usePlans } from '../hooks/usePlans';
import * as CalendarService from '../services/calendar.service';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { getDefaultTimeForCategory } from '@/modules/interactions';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';

interface PlanWizardProps {
  visible: boolean;
  onClose: () => void;
  initialFriend: FriendModel; // The friend from whose profile the wizard was opened
  // Optional prefill from suggestions or reschedule
  prefillData?: {
    date?: Date;
    category?: InteractionCategory;
    title?: string;
    location?: string;
  };
  // Optional: ID of existing interaction to replace (for reschedule)
  replaceInteractionId?: string;
  // Optional: Starting step (1-3), defaults to 1
  initialStep?: number;
}

export interface PlanFormData {
  date: Date;
  category: InteractionCategory;
  title?: string;
  location?: string;
  time?: Date; // Optional time of day
  notes?: string;
}

export function PlanWizard({ visible, onClose, initialFriend, prefillData, replaceInteractionId, initialStep = 1 }: PlanWizardProps) {
  const { colors, isDarkMode } = useTheme();
  const { planWeave, deleteWeave } = usePlans();
  const suggestion = usePlanSuggestion(initialFriend);

  const [currentStep, setCurrentStep] = useState(initialStep); // Start from initialStep
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [selectedFriends, setSelectedFriends] = useState<FriendModel[]>([initialFriend]); // Manage internally
  const [formData, setFormData] = useState<Partial<PlanFormData>>({
    date: prefillData?.date,
    category: prefillData?.category || suggestion?.suggestedCategory,
    title: prefillData?.title,
    location: prefillData?.location,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track whether we've transitioned between steps (vs initial render)
  const hasTransitioned = useRef(false);

  const updateFormData = (updates: Partial<PlanFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Handler for category selection with smart time defaults
  const handleCategorySelect = (category: InteractionCategory) => {
    // Apply smart default time when category is selected
    const planDate = formData.date || new Date();
    const defaultTime = getDefaultTimeForCategory(category, planDate);

    updateFormData({
      category,
      time: defaultTime, // Set smart default time
    });
  };

  // Reset to initialStep when modal opens or initialStep changes
  useEffect(() => {
    if (visible) {
      setCurrentStep(initialStep);
      hasTransitioned.current = false; // Reset on modal open
    }
  }, [visible, initialStep]);

  const goToNextStep = () => {
    if (currentStep < 3) { // Max step is 3
      setDirection('forward');
      hasTransitioned.current = true; // Mark that we've transitioned
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) { // Min step is 1
      setDirection('backward');
      hasTransitioned.current = true; // Mark that we've transitioned
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // Reset state
    setCurrentStep(initialStep);
    setSelectedFriends([initialFriend]); // Reset selected friends
    setFormData({});
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.category) {
      console.error('Missing required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // If rescheduling, delete the old plan first
      if (replaceInteractionId) {
        await deleteWeave(replaceInteractionId);
      }

      // Merge date and time if time is set
      let finalDate = formData.date;
      if (formData.time) {
        finalDate = new Date(formData.date);
        finalDate.setHours(
          formData.time.getHours(),
          formData.time.getMinutes(),
          0,
          0
        );
      }

      // Create the interaction
      const newPlan = await planWeave({
        friendIds: selectedFriends.map(f => f.id),
        activity: formData.category,
        category: formData.category,
        notes: formData.notes,
        date: finalDate,
        type: 'plan',
        status: 'planned',
        mode: selectedFriends.length > 1 ? 'group' : 'one-on-one',
        // Include title and location
        title: formData.title?.trim() || undefined,
        location: formData.location?.trim() || undefined,
      });

      // Try to create calendar event if settings enabled
      try {
        const settings = await CalendarService.getCalendarSettings();
        if (settings.enabled) {
          const categoryMeta = getCategoryMetadata(formData.category);
          const friendNames = selectedFriends.map(f => f.name).join(', ');
          const eventTitle = formData.title?.trim() || `${categoryMeta?.label || formData.category} with ${friendNames}`;

          const calendarEventId = await CalendarService.createWeaveCalendarEvent({
            title: eventTitle,
            friendNames: friendNames, // Pass all friend names
            category: categoryMeta?.label || formData.category,
            date: finalDate, // Use the merged date with time
            location: formData.location?.trim(),
            notes: formData.notes?.trim(),
          });

          // If calendar event created successfully, update the interaction with the event ID
          if (calendarEventId && newPlan.id) {
            await database.write(async () => {
              const interaction = await database.get<Interaction>('interactions').find(newPlan.id);
              await interaction.update(i => {
                i.calendarEventId = calendarEventId;
              });
            });
          }
        }
      } catch (calendarError) {
        // Don't fail the plan creation if calendar sync fails
        console.warn('Calendar event creation failed:', calendarError);
      }

      handleClose();
    } catch (error) {
      console.error('Error creating plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromStep1 = !!formData.date;
  const canProceedFromStep2 = !!formData.category;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: colors.border }}
        >
          {currentStep > 1 ? (
            <TouchableOpacity onPress={goToPreviousStep} className="p-2">
              <ArrowLeft size={20} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose} className="p-2">
              <X size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}

          <View className="flex-1 items-center">
            <Text className="font-lora-bold text-lg" style={{ color: colors.foreground }}>
              Schedule with {selectedFriends.map(f => f.name).join(', ')}
            </Text>
            <Text className="font-inter-regular text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
              Step {currentStep} of 3
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Progress indicator */}
        <View className="flex-row px-5 py-3">
          {[1, 2, 3].map(step => (
            <View
              key={step}
              className="flex-1 h-1 rounded mx-1"
              style={{
                backgroundColor: step <= currentStep ? colors.primary : colors.muted,
              }}
            />
          ))}
        </View>

        {/* Step content with animations */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
          {currentStep === 1 && (
            <Animated.View
              key="step1"
              entering={hasTransitioned.current ? (direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)) : undefined}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep1
                selectedDate={formData.date}
                onDateSelect={date => updateFormData({ date })}
                onContinue={goToNextStep}
                canContinue={canProceedFromStep1}
                friend={initialFriend}
              />
            </Animated.View>
          )}

          {currentStep === 2 && (
            <Animated.View
              key="step2"
              entering={hasTransitioned.current ? (direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)) : undefined}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep2
                selectedCategory={formData.category}
                onCategorySelect={handleCategorySelect}
                onContinue={goToNextStep}
                canContinue={canProceedFromStep2}
                friend={initialFriend}
                suggestion={suggestion}
              />
            </Animated.View>
          )}

          {currentStep === 3 && (
            <Animated.View
              key="step3"
              entering={hasTransitioned.current ? (direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)) : undefined}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep3
                formData={formData}
                onUpdate={updateFormData}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                friend={initialFriend}
                suggestion={suggestion}
                selectedFriends={selectedFriends}
                onFriendsSelect={setSelectedFriends}
              />
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
