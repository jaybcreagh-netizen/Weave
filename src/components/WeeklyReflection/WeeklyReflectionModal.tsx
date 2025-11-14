/**
 * WeeklyReflectionModal
 * Main modal for weekly reflection ritual
 * Beautiful, native-feeling 4-step flow: Summary → Calendar Events → Reconnect → Gratitude
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { X, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { WeeklySummary, calculateWeeklySummary } from '../../lib/weekly-reflection/weekly-stats';
import { markReflectionComplete } from '../../lib/notification-manager-enhanced';
import { WeekSummary } from './WeekSummary';
import { MissedConnectionsList } from './MissedConnectionsList';
import { GratitudePrompt } from './GratitudePrompt';
import { CalendarEventsStep } from './CalendarEventsStep';
import { database } from '../../db';
import WeeklyReflection from '../../db/models/WeeklyReflection';
import { getTopStoryChipSuggestions, WeekStoryChipSuggestion } from '../../lib/weekly-reflection/story-chip-aggregator';
import { batchLogCalendarEvents } from '../../lib/weekly-event-review';
import { ScannedEvent } from '../../lib/event-scanner';
import * as Haptics from 'expo-haptics';

interface WeeklyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'summary' | 'events' | 'missed' | 'gratitude';

export function WeeklyReflectionModal({ isOpen, onClose }: WeeklyReflectionModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [storyChipSuggestions, setStoryChipSuggestions] = useState<WeekStoryChipSuggestion[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<ScannedEvent[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSummary();
      setCurrentStep('summary');
    }
  }, [isOpen]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const [data, chipSuggestions] = await Promise.all([
        calculateWeeklySummary(),
        getTopStoryChipSuggestions(6), // Get top 6 suggestions
      ]);
      setSummary(data);
      setStoryChipSuggestions(chipSuggestions);
    } catch (error) {
      console.error('Error loading weekly summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (
    gratitudeText: string,
    prompt: string,
    promptContext: string,
    storyChips: Array<{ chipId: string; customText?: string }>
  ) => {
    if (!summary) return;

    try {
      // Batch log selected calendar events if any
      if (selectedEvents.length > 0) {
        const emotionalRating = gratitudeText.trim().length > 0 ? 8 : undefined; // High rating if they wrote gratitude
        await batchLogCalendarEvents({
          events: selectedEvents,
          emotionalRating,
          reflectionNotes: gratitudeText.trim().length > 0 ? gratitudeText : undefined,
        });
        console.log(`[WeeklyReflection] Batch logged ${selectedEvents.length} calendar events`);
      }

      // Save weekly reflection to database
      await database.write(async () => {
        await database.get<WeeklyReflection>('weekly_reflections').create((reflection) => {
          reflection.weekStartDate = summary.weekStartDate.getTime();
          reflection.weekEndDate = summary.weekEndDate.getTime();
          reflection.totalWeaves = summary.totalWeaves;
          reflection.friendsContacted = summary.friendsContacted;
          reflection.topActivity = summary.topActivity;
          reflection.topActivityCount = summary.topActivityCount;
          reflection.missedFriendsCount = summary.missedFriends.length;
          reflection.gratitudeText = gratitudeText.trim().length > 0 ? gratitudeText : undefined;
          reflection.gratitudePrompt = prompt;
          reflection.promptContext = promptContext;
          reflection.storyChips = storyChips; // Save story chips
          reflection.completedAt = new Date();
        });
      });

      // Mark reflection as complete (for timing)
      await markReflectionComplete();

      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error saving weekly reflection:', error);
      // Still close modal even if save fails
      onClose();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'events') {
      setCurrentStep('summary');
    } else if (currentStep === 'missed') {
      setCurrentStep('events');
    } else if (currentStep === 'gratitude') {
      setCurrentStep('missed');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const stepTitles: Record<Step, string> = {
    summary: 'Your Week',
    events: 'Calendar Events',
    missed: 'Reconnect',
    gratitude: 'Gratitude',
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          {/* Back Button */}
          {currentStep !== 'summary' ? (
            <TouchableOpacity onPress={handleBack} className="p-2 -ml-2">
              <ChevronLeft size={24} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <View className="w-10" />
          )}

          {/* Title */}
          <View className="flex-1 items-center">
            <Text
              className="text-lg font-semibold"
              style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
            >
              {stepTitles[currentStep]}
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        {/* Step Indicator */}
        <View className="flex-row px-5 py-4 gap-2">
          {(['summary', 'events', 'missed', 'gratitude'] as Step[]).map((step, index) => {
            const stepIndex = ['summary', 'events', 'missed', 'gratitude'].indexOf(currentStep);
            const isActive = step === currentStep;
            const isCompleted = index < stepIndex;

            return (
              <View
                key={step}
                className="flex-1 h-1 rounded-full"
                style={{
                  backgroundColor: isActive || isCompleted ? colors.primary : colors.muted,
                  opacity: isActive ? 1 : isCompleted ? 0.6 : 0.3,
                }}
              />
            );
          })}
        </View>

        {/* Content */}
        <View className="flex-1 px-5 py-4">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                className="text-sm mt-4"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Calculating your week...
              </Text>
            </View>
          ) : summary ? (
            <>
              {currentStep === 'summary' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <WeekSummary
                    summary={summary}
                    onNext={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentStep('events');
                    }}
                  />
                </Animated.View>
              )}

              {currentStep === 'events' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <CalendarEventsStep
                    onNext={(events) => {
                      setSelectedEvents(events);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentStep('missed');
                    }}
                    onSkip={() => {
                      setSelectedEvents([]);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentStep('missed');
                    }}
                  />
                </Animated.View>
              )}

              {currentStep === 'missed' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <MissedConnectionsList
                    missedFriends={summary.missedFriends}
                    onNext={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentStep('gratitude');
                    }}
                    onSkip={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentStep('gratitude');
                    }}
                  />
                </Animated.View>
              )}

              {currentStep === 'gratitude' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <GratitudePrompt
                    summary={summary}
                    storyChipSuggestions={storyChipSuggestions}
                    onComplete={handleComplete}
                  />
                </Animated.View>
              )}
            </>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text
                className="text-base text-center"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Unable to load weekly summary. Please try again.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
