import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X, ArrowLeft } from 'lucide-react-native';
import { useActivityKeepAwake } from '../hooks/useActivityKeepAwake';
import { useTheme } from '../hooks/useTheme';
import FriendModel from '../db/models/Friend';
import { type InteractionCategory } from './types';
import { usePlanSuggestion } from '../hooks/usePlanSuggestion';
import { PlanWizardStep1 } from './plan-wizard/PlanWizardStep1';
import { PlanWizardStep2 } from './plan-wizard/PlanWizardStep2';
import { PlanWizardStep3 } from './plan-wizard/PlanWizardStep3';
import { useInteractionStore } from '../stores/interactionStore';
import { createWeaveCalendarEvent, getCalendarSettings } from '../lib/calendar-service';
import { getCategoryMetadata } from '../lib/interaction-categories';
import { database } from '../db';
import Interaction from '../db/models/Interaction';

interface PlanWizardProps {
  visible: boolean;
  onClose: () => void;
  friend: FriendModel;
  // Optional prefill from suggestions or reschedule
  prefillData?: {
    date?: Date;
    category?: InteractionCategory;
    title?: string;
    location?: string;
  };
  // Optional: ID of existing interaction to replace (for reschedule)
  replaceInteractionId?: string;
}

export interface PlanFormData {
  date: Date;
  category: InteractionCategory;
  title?: string;
  location?: string;
  time?: Date; // Optional time of day
  notes?: string;
}

export function PlanWizard({ visible, onClose, friend, prefillData, replaceInteractionId }: PlanWizardProps) {
  const { colors, isDarkMode } = useTheme();
  const { addInteraction, deleteInteraction } = useInteractionStore();
  const suggestion = usePlanSuggestion(friend);
  const resetActivityTimer = useActivityKeepAwake('plan-wizard');

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [formData, setFormData] = useState<Partial<PlanFormData>>({
    date: prefillData?.date,
    category: prefillData?.category || suggestion?.suggestedCategory,
    title: prefillData?.title,
    location: prefillData?.location,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = (updates: Partial<PlanFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const goToNextStep = () => {
    if (currentStep < 3) {
      setDirection('forward');
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setDirection('backward');
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // Reset state
    setCurrentStep(1);
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
        await deleteInteraction(replaceInteractionId);
      }

      // Create the interaction
      const interactionId = await addInteraction({
        friendIds: [friend.id],
        activity: formData.category,
        category: formData.category,
        notes: formData.notes,
        date: formData.date,
        type: 'plan',
        status: 'planned',
        mode: 'one-on-one',
        // Include title and location
        title: formData.title?.trim() || undefined,
        location: formData.location?.trim() || undefined,
      });

      // Try to create calendar event if settings enabled
      try {
        const settings = await getCalendarSettings();
        if (settings.enabled) {
          const categoryMeta = getCategoryMetadata(formData.category);
          const eventTitle = formData.title?.trim() || `${categoryMeta?.label || formData.category} with ${friend.name}`;

          const calendarEventId = await createWeaveCalendarEvent({
            title: eventTitle,
            friendName: friend.name,
            category: categoryMeta?.label || formData.category,
            date: formData.date,
            location: formData.location?.trim(),
            notes: formData.notes?.trim(),
          });

          // If calendar event created successfully, update the interaction with the event ID
          if (calendarEventId && interactionId) {
            await database.write(async () => {
              const interaction = await database.get<Interaction>('interactions').find(interactionId);
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} onTouchStart={resetActivityTimer}>
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
              Schedule with {friend.name}
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
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep1
                selectedDate={formData.date}
                onDateSelect={date => updateFormData({ date })}
                onContinue={goToNextStep}
                canContinue={canProceedFromStep1}
                friend={friend}
              />
            </Animated.View>
          )}

          {currentStep === 2 && (
            <Animated.View
              key="step2"
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep2
                selectedCategory={formData.category}
                onCategorySelect={category => updateFormData({ category })}
                onContinue={goToNextStep}
                canContinue={canProceedFromStep2}
                friend={friend}
                suggestion={suggestion}
              />
            </Animated.View>
          )}

          {currentStep === 3 && (
            <Animated.View
              key="step3"
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
            >
              <PlanWizardStep3
                formData={formData}
                onUpdate={updateFormData}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                friend={friend}
                suggestion={suggestion}
              />
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
