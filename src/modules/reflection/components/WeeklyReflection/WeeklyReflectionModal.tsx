/**
 * WeeklyReflectionModal (Redesigned)
 *
 * Sunday check-in flow: 60 seconds, writing-first, compact celebration.
 *
 * Flow:
 * 1. ReflectionPromptStep - Contextual question with Oracle observations, optional writing
 * 2. OracleSummaryStep - Personalized Oracle narrative of the week
 * 3. WeekSnapshotStep - Compact stats, insight, up to 3 friends needing attention
 * 4. CalendarEventsStep - Only if unlogged events exist (optional catch-up)
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Keyboard, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import {
  scanWeekForUnloggedEvents,
  batchLogCalendarEvents,
} from '../../services/weekly-event-review';
import {
  ExtendedWeeklySummary,
  calculateExtendedWeeklySummary,
} from '../../services/weekly-summary-extended.service';
import {
  generateReflectionPrompt,
  generateInsightLine,
  ReflectionPrompt,
  InsightLine,
  PromptEngineInput,
} from '../../services/prompt-engine';
import { notificationStore } from '@/modules/notifications/services/notification-store';
import { SocialSeasonService } from '@/modules/intelligence/services/social-season.service';
import { ReflectionPromptStep } from './ReflectionPromptStepComponent';
import { WeekSnapshotStep } from './WeekSnapshotStepComponent';
import { CalendarEventsStep } from './CalendarEventsStepComponent';
import { database } from '@/db';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { ScannedEvent } from '@/modules/interactions/services/event-scanner';
import * as Haptics from 'expo-haptics';
import { WeeklyReflectionChannel } from '@/modules/notifications/services/channels/weekly-reflection';
import { logger } from '@/shared/services/logger.service';
import { OracleSummaryStep } from './OracleSummaryStep';
import { oracleService } from '@/modules/oracle/services/oracle-service';
import { reflectionSynthesizer } from '../../services/ReflectionSynthesizerService';
import { UIEventBus } from '@/shared/services/ui-event-bus';
import { useUserProfile } from '@/modules/auth';
import { generateLocalWeeklyNarrative } from '../../services/weekly-reflection-content.service';

// ============================================================================
// TYPES
// ============================================================================

interface WeeklyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'prompt' | 'summary' | 'snapshot' | 'events';

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
  const insets = useSafeAreaInsets();
  const { intelligenceCapabilities } = useUserProfile();

  // State
  const [currentStep, setCurrentStep] = useState<Step>('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<ExtendedWeeklySummary | null>(null);
  const [prompt, setPrompt] = useState<ReflectionPrompt | null>(null);
  const [insight, setInsight] = useState<InsightLine | null>(null);
  const [reflectionData, setReflectionData] = useState<ReflectionData>({ text: '', chipIds: [] });
  const [hasUnloggedEvents, setHasUnloggedEvents] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<ScannedEvent[]>([]);
  const [weeklyNarrative, setWeeklyNarrative] = useState<string | null>(null); // Oracle narrative
  const [observations, setObservations] = useState<string[]>([]); // Network observations

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset state when closed
      setCurrentStep('prompt');
      setReflectionData({ text: '', chipIds: [] });
      setSelectedEvents([]);
      setIsSaving(false);
      setWeeklyNarrative(null);
      setObservations([]);
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

      // Fetch current season
      const season = await SocialSeasonService.getCurrentSeason();
      const localNarrative = generateLocalWeeklyNarrative(summaryData, season);

      // Generate narrative (non-blocking)
      if (intelligenceCapabilities.oracleChatEnabled) {
        oracleService.generateWeeklyNarrative(summaryData, season).then(narrative => {
          setWeeklyNarrative(narrative);
        }).catch(err => {
          logger.warn('WeeklyReflection', 'Error generating narrative', err);
          setWeeklyNarrative(localNarrative);
        });
      } else {
        setWeeklyNarrative(localNarrative);
      }

      // Generate observations (non-blocking)
      const weekStart = summaryData.weekStartDate.getTime();
      const weekEnd = summaryData.weekEndDate.getTime();
      // Use user ID if available in future, currently undefined implies current user context from DB
      reflectionSynthesizer.generateWeeklyObservations(undefined, weekStart, weekEnd).then(obs => {
        setObservations(obs);
      }).catch(err => {
        logger.warn('WeeklyReflection', 'Error generating observations', err);
        setObservations([]);
      });

    } catch (error) {
      logger.error('WeeklyReflection', 'Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // STEP HANDLERS
  // ============================================================================

  const handlePromptNext = (text: string, chipIds: string[]) => {
    setReflectionData({ text, chipIds });
    setCurrentStep('summary');
  };

  const handleSummaryNext = () => {
    setCurrentStep('snapshot');
  };

  const handleSnapshotComplete = async () => {
    // Save completion
    if (summary) {
      await notificationStore.setLastReflectionDate(new Date());
    }

    // Move to next step or save and close
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

  const [isSaving, setIsSaving] = useState(false);

  const saveAndClose = async (events?: ScannedEvent[]) => {
    if (!summary || !prompt) return;

    Keyboard.dismiss();
    setIsSaving(true);

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
        logger.info('WeeklyReflection', `Batch logged ${eventsToLog.length} calendar events`);
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
          reflection.oracleObservations = observations;
          reflection.completedAt = new Date();
        });
      });

      // Mark reflection as complete (for timing/notifications)
      await notificationStore.setLastReflectionDate(new Date());
      // Cancel the scheduled notification since user completed it now
      await WeeklyReflectionChannel.cancel('weekly-reflection');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const { useUIStore } = await import('@/shared/stores/uiStore');
      useUIStore.getState().showToast('Weekly reflection saved', '');

      // Notify listeners (like JournalWidget) that reflection is done
      UIEventBus.emit({ type: 'WEEKLY_REFLECTION_COMPLETED' });

      onClose();

    } catch (error) {
      logger.error('WeeklyReflection', 'Error saving reflection:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSaving(false);
      Alert.alert(
        'Couldn\'t save',
        'Your reflection couldn\'t be saved. Would you like to try again?',
        [
          { text: 'Discard', style: 'destructive', onPress: onClose },
          { text: 'Retry', onPress: () => saveAndClose(events) },
        ],
      );
    }
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const handleBack = () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'summary') {
      setCurrentStep('prompt');
    } else if (currentStep === 'snapshot') {
      setCurrentStep('summary');
    } else if (currentStep === 'events') {
      setCurrentStep('snapshot');
    }
  };

  const handleClose = () => {
    Keyboard.dismiss(); // Ensure keyboard is gone
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const stepTitles: Record<Step, string> = {
    prompt: 'Check-in',
    summary: intelligenceCapabilities.oracleChatEnabled ? 'Oracle Insight' : 'Weekly Insight',
    snapshot: 'Your Week',
    events: 'Calendar',
  };

  // Progress indicator
  const steps: Step[] = hasUnloggedEvents ? ['prompt', 'summary', 'snapshot', 'events'] : ['prompt', 'summary', 'snapshot'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Week summary line for the prompt step header
  const weekSummaryLine = summary
    ? `Your week: ${summary.totalWeaves} weave${summary.totalWeaves !== 1 ? 's' : ''} with ${summary.friendsContacted} friend${summary.friendsContacted !== 1 ? 's' : ''}`
    : undefined;

  // Render content directly inside BottomSheet (bypasses BottomSheetView wrapper)
  // Each step manages its own BottomSheetScrollView for proper gesture handling
  const renderContent = () => (
    <View style={{ flex: 1 }}>
      {/* Back Button */}
      {currentStep !== 'prompt' && (
        <View className="px-5 pb-3 border-b border-border">
          <TouchableOpacity onPress={handleBack} className="flex-row items-center gap-1">
            <ChevronLeft size={20} color={colors.foreground} />
            <Text variant="body" className="font-medium text-foreground">Back</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Step Content */}
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 16) }}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <WeaveLoading size={48} />
            <Text variant="caption" className="text-muted-foreground mt-4">
              Preparing your check-in...
            </Text>
          </View>
        ) : summary && prompt && insight ? (
          <>
            {currentStep === 'prompt' && (
              <ReflectionPromptStep
                prompt={prompt}
                promptEngineInput={buildPromptEngineInput(summary)}
                observations={observations}
                narrative={weeklyNarrative}
                weekSummaryLine={weekSummaryLine}
                onNext={handlePromptNext}
              />
            )}

            {currentStep === 'summary' && (
              <View style={{ flex: 1 }}>
                <OracleSummaryStep
                  narrative={weeklyNarrative}
                  mode={intelligenceCapabilities.oracleChatEnabled ? 'oracle' : 'local'}
                  onContinue={handleSummaryNext}
                />
              </View>
            )}

            {currentStep === 'snapshot' && (
              <WeekSnapshotStep
                summary={summary}
                insight={insight}
                onComplete={handleSnapshotComplete}
              />
            )}

            {currentStep === 'events' && (
              <CalendarEventsStep
                onNext={handleEventsNext}
                onSkip={handleEventsSkip}
              />
            )}
          </>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text variant="body" className="text-muted-foreground text-center">
              Unable to load check-in. Please try again.
            </Text>
            <Button
              onPress={loadData}
              variant="primary"
              className="mt-4"
              label="Retry"
            />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={handleClose}
      height="full"
      title={stepTitles[currentStep]}
      keyboardBlurBehavior="none"
      disableContentPanning={true}
      renderScrollContent={renderContent}
    >
      <></>
    </StandardBottomSheet>
  );
}
