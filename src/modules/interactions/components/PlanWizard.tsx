import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView, Alert, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import {
  X,
  ArrowLeft,
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
import FriendModel from '@/db/models/Friend';
import { InteractionCategory } from '@/shared/types/common';
import { usePlanSuggestion } from '../hooks/usePlanSuggestion';
import { PlanWizardStep1 } from './plan-wizard/PlanWizardStep1';
import { PlanWizardStep2 } from './plan-wizard/PlanWizardStep2';
import { PlanWizardStep3 } from './plan-wizard/PlanWizardStep3';
import { usePlans } from '../hooks/usePlans';
import * as CalendarService from '../services/calendar.service';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { getDefaultTimeForCategory, calculateActivityPriorities, isSmartDefaultsEnabled } from '../services/smart-defaults.service';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import { startOfDay, addDays, isSaturday, nextSaturday, getDay } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { InitiatorType } from '@/modules/relationships';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';

const CATEGORIES: Array<{
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
  initiator?: InitiatorType;
  shouldShare?: boolean;
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

  // Lifted state for performance
  const [plannedDates, setPlannedDates] = useState<Date[]>([]);
  const [mostCommonDay, setMostCommonDay] = useState<{ day: number; name: string; date: Date } | null>(null);
  const [orderedCategories, setOrderedCategories] = useState(CATEGORIES);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to bottom when keyboard opens (for notes input)
  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(keyboardShowEvent, () => {
      // Scroll to show the input above keyboard
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => subscription.remove();
  }, []);

  // Fetch all data once on mount
  useEffect(() => {
    const loadData = async () => {
      const today = startOfDay(new Date());
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      try {
        // 1. Fetch Planned Dates (Safe 2-step query)
        // Step A: Get all interaction IDs for this friend
        const interactionLinks = await database
          .get('interaction_friends')
          .query(Q.where('friend_id', initialFriend.id))
          .fetch();

        const interactionIds = interactionLinks.map((link: any) => link.interactionId);

        // Step B: Fetch the actual interactions if we have any links
        let plannedInteractions: Interaction[] = [];
        if (interactionIds.length > 0) {
          plannedInteractions = await database
            .get<Interaction>('interactions')
            .query(
              Q.where('id', Q.oneOf(interactionIds)),
              Q.where('status', 'planned'),
              Q.where('interaction_date', Q.gte(today.getTime()))
            )
            .fetch();
        }

        setPlannedDates(plannedInteractions.map(i => startOfDay(i.interactionDate)));

        // 2. Calculate Most Common Day (Safe 2-step query)
        let completedInteractions: Interaction[] = [];
        if (interactionIds.length > 0) {
          completedInteractions = await database
            .get<Interaction>('interactions')
            .query(
              Q.where('id', Q.oneOf(interactionIds)),
              Q.where('status', 'completed')
            )
            .fetch();
        }

        if (completedInteractions.length > 0) {
          const dayCounts: Record<number, number> = {};
          completedInteractions.forEach(interaction => {
            const dayOfWeek = getDay(interaction.interactionDate);
            dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
          });

          let maxCount = 0;
          let commonDay = 0;
          Object.entries(dayCounts).forEach(([day, count]) => {
            if (count > maxCount) {
              maxCount = count;
              commonDay = parseInt(day);
            }
          });

          const currentDay = getDay(today);
          let nextOccurrence: Date;
          if (commonDay === currentDay) {
            nextOccurrence = today;
          } else if (commonDay > currentDay) {
            nextOccurrence = addDays(today, commonDay - currentDay);
          } else {
            nextOccurrence = addDays(today, 7 - currentDay + commonDay);
          }

          setMostCommonDay({
            day: commonDay,
            name: dayNames[commonDay],
            date: nextOccurrence,
          });
        }

        // 3. Calculate Category Priorities
        const smartDefaultsEnabled = await isSmartDefaultsEnabled();
        if (smartDefaultsEnabled) {
          const priorities = await calculateActivityPriorities(initialFriend);
          const scoreMap = new Map(priorities.map(p => [p.category, p.score]));
          const sorted = [...CATEGORIES].sort((a, b) => {
            const scoreA = scoreMap.get(a.value) || 0;
            const scoreB = scoreMap.get(b.value) || 0;
            return scoreB - scoreA;
          });
          setOrderedCategories(sorted);
        }
      } catch (error) {
        console.error('Error loading plan wizard data:', error);
      }
    };

    loadData();
  }, [initialFriend.id]);

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

  const handleSubmit = useDebounceCallback(async () => {
    // Validate required fields with user feedback
    if (!formData.category) {
      Alert.alert('Select Activity Type', 'Please choose an activity type before scheduling.');
      setDirection('backward');
      setCurrentStep(2);
      return;
    }
    if (!formData.date) {
      Alert.alert('Select Date', 'Please choose a date before scheduling.');
      setDirection('backward');
      setCurrentStep(1);
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
        initiator: formData.initiator,
      });

      handleClose();

      // Run secondary operations in background
      (async () => {
        // Try to create calendar event if settings enabled
        try {
          const settings = await CalendarService.getCalendarSettings();
          if (settings.enabled) {
            const categoryMeta = getCategoryMetadata(formData.category!);
            const friendNames = selectedFriends.map(f => f.name).join(', ');
            const eventTitle = formData.title?.trim() || `${categoryMeta?.label || formData.category} with ${friendNames}`;

            const result = await CalendarService.createWeaveCalendarEventWithResult({
              title: eventTitle,
              friendNames: friendNames,
              category: categoryMeta?.label || formData.category!,
              date: finalDate,
              location: formData.location?.trim(),
              notes: formData.notes?.trim(),
            });

            if (result.success && result.eventId && newPlan.id) {
              // Calendar event created successfully - update the interaction with the event ID
              await database.write(async () => {
                const interaction = await database.get<Interaction>('interactions').find(newPlan.id);
                await interaction.update(i => {
                  i.calendarEventId = result.eventId!;
                });
              });
            } else if (!result.success && result.error !== 'disabled') {
              // Show toast for calendar failures
              import('@/shared/stores/uiStore').then(({ useUIStore }) => {
                useUIStore.getState().showToast(
                  'Calendar sync failed',
                  result.message || 'Could not add to calendar'
                );
              });
            }
          }
        } catch (calendarError) {
          console.warn('Calendar event creation failed:', calendarError);
        }

        // SHARE LOGIC (Phase 4)
        if (formData.shouldShare && newPlan.id) {
          try {
            const linkedFriends = selectedFriends.filter(f => f.linkedUserId);
            if (linkedFriends.length > 0) {
              const { executeShareWeave } = await import('@/modules/sync/services/sync-operations');
              await executeShareWeave({
                interactionId: newPlan.id,
                participantUserIds: linkedFriends.map(f => f.linkedUserId!),
                title: formData.title,
                weaveDate: finalDate.toISOString(),
                location: formData.location,
                category: formData.category!,
                duration: null,
                note: formData.notes,
              });
            }
          } catch (shareErr) {
            console.warn('Share failed:', shareErr);
          }
        }
      })();
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Error', 'Failed to create plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  });

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
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
                  plannedDates={plannedDates}
                  mostCommonDay={mostCommonDay}
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
                  orderedCategories={orderedCategories}
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
