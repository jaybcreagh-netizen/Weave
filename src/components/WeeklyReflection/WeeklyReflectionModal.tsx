/**
 * WeeklyReflectionModal (Redesigned)
 * 
 * Sunday check-in flow: 60 seconds, writing-first, compact celebration.
 * 
 * Flow:
 * 1. ReflectionPromptStep - One contextual question, optional writing, chip detection
 * 2. WeekSnapshotStep - Compact stats, insight, up to 3 friends needing attention
 * 3. CalendarEventsStep - Only if unlogged events exist (optional catch-up)
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { X, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  scanWeekForUnloggedEvents,
  batchLogCalendarEvents,
} from '@/modules/reflection';
import {
  ExtendedWeeklySummary,
  calculateExtendedWeeklySummary,
  extendWeeklySummary,
} from '@/modules/reflection/services/weekly-summary-extended.service';
import {
  generateReflectionPrompt,
  generateInsightLine,
  ReflectionPrompt,
  InsightLine,
  PromptEngineInput,
} from '@/modules/reflection/services/prompt-engine';
import { markReflectionComplete } from '@/modules/notifications';
import { ReflectionPromptStep } from './ReflectionPromptStepComponent';
import { WeekSnapshotStep } from './WeekSnapshotStepComponent';
import { CalendarEventsStep } from './CalendarEventsStepComponent';
import { database } from '@/db';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { ScannedEvent } from '@/modules/interactions';
import * as Haptics from 'expo-haptics';

// ============================================================================
// TYPES
// ============================================================================

interface WeeklyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'prompt' | 'snapshot' | 'events';

interface ReflectionData {
  text: string;
  chipIds: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build prompt engine input from extended weekly summary
 * The ExtendedWeeklySummary already has all the data we need
 */
function buildPromptEngineInput(summary: ExtendedWeeklySummary): PromptEngineInput {
  // Find top friend (most weaves this week)
  const topFriend = summary.friendActivity.length > 0
    ? summary.friendActivity[0]
    : undefined;

  // Find reconnected friend (first from reconnections list)
  const reconnectedFriend = summary.reconnections.length > 0
    ? summary.reconnections[0]
    : undefined;

  // Get comparison data for previous week
  const previousWeekWeaves = summary.comparison
    ? summary.totalWeaves - summary.comparison.weavesChange
    : undefined;

  return {
    totalWeaves: summary.totalWeaves,
    friendsContacted: summary.friendsContacted,
    topFriend: topFriend ? {
      id: topFriend.friendId,
      name: topFriend.friendName,
      weaveCount: topFriend.weaveCount,
    } : undefined,
    reconnectedFriend: reconnectedFriend ? {
      id: reconnectedFriend.friendId,
      name: reconnectedFriend.friendName,
      daysSinceLastContact: reconnectedFriend.daysSince,
    } : undefined,
    topActivity: summary.topActivity,
    topActivityCount: summary.topActivityCount,
    isQuietWeek: summary.totalWeaves < 2,
    previousWeekWeaves,
    weekStreak: summary.weekStreak,
    averageWeeklyWeaves: summary.averageWeeklyWeaves,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WeeklyReflectionModal({ isOpen, onClose }: WeeklyReflectionModalProps) {
  const { colors } = useTheme();

  // State
  const [currentStep, setCurrentStep] = useState<Step>('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<ExtendedWeeklySummary | null>(null);
  const [prompt, setPrompt] = useState<ReflectionPrompt | null>(null);
  const [insight, setInsight] = useState<InsightLine | null>(null);
  const [reflectionData, setReflectionData] = useState<ReflectionData>({ text: '', chipIds: [] });
  const [hasUnloggedEvents, setHasUnloggedEvents] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<ScannedEvent[]>([]);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset state when closed
      setCurrentStep('prompt');
      setReflectionData({ text: '', chipIds: [] });
      setSelectedEvents([]);
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load extended weekly summary (includes friendActivity, reconnections, weekStreak)
      const summaryData = await calculateExtendedWeeklySummary();
      setSummary(summaryData);

      // Build prompt engine input and generate prompt/insight
      const promptInput = buildPromptEngineInput(summaryData);
      const generatedPrompt = generateReflectionPrompt(promptInput);
      const generatedInsight = generateInsightLine(promptInput);

      setPrompt(generatedPrompt);
      setInsight(generatedInsight);

      // Check for unlogged calendar events
      const eventReview = await scanWeekForUnloggedEvents();
      setHasUnloggedEvents(eventReview.events.length > 0);

    } catch (error) {
      console.error('[WeeklyReflectionModal] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // STEP HANDLERS
  // ============================================================================

  const handlePromptNext = (text: string, chipIds: string[]) => {
    setReflectionData({ text, chipIds });
    setCurrentStep('snapshot');
  };

  const handleSnapshotComplete = async () => {
    if (hasUnloggedEvents) {
      setCurrentStep('events');
    } else {
      await saveAndClose();
    }
  };

  const handleEventsNext = async (events: ScannedEvent[]) => {
    setSelectedEvents(events);
    await saveAndClose(events);
  };

  const handleEventsSkip = async () => {
    await saveAndClose();
  };

  // ============================================================================
  // SAVE & CLOSE
  // ============================================================================

  const saveAndClose = async (events?: ScannedEvent[]) => {
    if (!summary || !prompt) return;

    try {
      const eventsToLog = events || selectedEvents;

      // Batch log selected calendar events if any
      if (eventsToLog.length > 0) {
        const emotionalRating = reflectionData.text.trim().length > 0 ? 8 : undefined;
        await batchLogCalendarEvents({
          events: eventsToLog,
          emotionalRating,
          reflectionNotes: reflectionData.text.trim().length > 0 ? reflectionData.text : undefined,
        });
        console.log(`[WeeklyReflection] Batch logged ${eventsToLog.length} calendar events`);
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
          reflection.gratitudeText = reflectionData.text.trim().length > 0 ? reflectionData.text : undefined;
          reflection.gratitudePrompt = prompt.question;
          reflection.promptContext = prompt.context;
          reflection.storyChips = reflectionData.chipIds.map(chipId => ({ chipId }));
          reflection.completedAt = new Date();
        });
      });

      // Mark reflection as complete (for timing/notifications)
      await markReflectionComplete();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();

    } catch (error) {
      console.error('[WeeklyReflectionModal] Error saving reflection:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Still close even if save fails
      onClose();
    }
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'snapshot') {
      setCurrentStep('prompt');
    } else if (currentStep === 'events') {
      setCurrentStep('snapshot');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const stepTitles: Record<Step, string> = {
    prompt: 'Check-in',
    snapshot: 'Your Week',
    events: 'Calendar',
  };

  // Progress indicator
  const steps: Step[] = hasUnloggedEvents ? ['prompt', 'snapshot', 'events'] : ['prompt', 'snapshot'];
  const currentStepIndex = steps.indexOf(currentStep);

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
          {currentStep !== 'prompt' ? (
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

        {/* Progress Indicator */}
        <View className="flex-row px-5 py-3 gap-2">
          {steps.map((step, index) => {
            const isActive = step === currentStep;
            const isCompleted = index < currentStepIndex;

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
        <View className="flex-1 px-5 py-2">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <WeaveLoading size={48} />
              <Text
                className="text-sm mt-4"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Preparing your check-in...
              </Text>
            </View>
          ) : summary && prompt && insight ? (
            <>
              {currentStep === 'prompt' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <ReflectionPromptStep
                    prompt={prompt}
                    onNext={handlePromptNext}
                  />
                </Animated.View>
              )}

              {currentStep === 'snapshot' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <WeekSnapshotStep
                    summary={summary}
                    insight={insight}
                    onComplete={handleSnapshotComplete}
                  />
                </Animated.View>
              )}

              {currentStep === 'events' && (
                <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1">
                  <CalendarEventsStep
                    onNext={handleEventsNext}
                    onSkip={handleEventsSkip}
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
                Unable to load check-in. Please try again.
              </Text>
              <TouchableOpacity
                onPress={loadData}
                className="mt-4 px-6 py-3 rounded-xl"
                style={{ backgroundColor: colors.primary }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
