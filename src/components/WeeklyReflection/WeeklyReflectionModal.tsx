/**
 * WeeklyReflectionModal
 * Main modal for weekly reflection ritual
 * Beautiful, native-feeling 3-step flow
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { X, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { WeeklySummary, calculateWeeklySummary } from '../../lib/weekly-reflection/weekly-stats';
import { markReflectionComplete } from '../../lib/notification-manager';
import { WeekSummary } from './WeekSummary';
import { MissedConnectionsList } from './MissedConnectionsList';
import { GratitudePrompt } from './GratitudePrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface WeeklyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'summary' | 'missed' | 'gratitude';

const GRATITUDE_STORAGE_KEY = '@weave:weekly_gratitude';

export function WeeklyReflectionModal({ isOpen, onClose }: WeeklyReflectionModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('summary');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSummary();
      setCurrentStep('summary');
    }
  }, [isOpen]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await calculateWeeklySummary();
      setSummary(data);
    } catch (error) {
      console.error('Error loading weekly summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (gratitudeText: string) => {
    // Save gratitude text if provided
    if (gratitudeText.trim().length > 0) {
      try {
        const gratitudeEntries = await AsyncStorage.getItem(GRATITUDE_STORAGE_KEY);
        const entries = gratitudeEntries ? JSON.parse(gratitudeEntries) : [];
        entries.push({
          date: new Date().toISOString(),
          text: gratitudeText,
        });
        await AsyncStorage.setItem(GRATITUDE_STORAGE_KEY, JSON.stringify(entries));
      } catch (error) {
        console.error('Error saving gratitude:', error);
      }
    }

    // Mark reflection as complete
    await markReflectionComplete();

    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Close modal
    onClose();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'missed') {
      setCurrentStep('summary');
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
          {(['summary', 'missed', 'gratitude'] as Step[]).map((step, index) => {
            const stepIndex = ['summary', 'missed', 'gratitude'].indexOf(currentStep);
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
                  <GratitudePrompt onComplete={handleComplete} />
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
