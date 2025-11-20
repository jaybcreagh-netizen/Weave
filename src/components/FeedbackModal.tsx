import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Send, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/shared/hooks/useTheme';
import { trackEvent, AnalyticsEvents } from '../shared/services/analytics.service';

// Optional: Lazy-load react-native-view-shot to avoid crash if not installed
let captureRef: any = null;
try {
  const viewShot = require('react-native-view-shot');
  captureRef = viewShot.captureRef;
} catch (e) {
  console.log('[FeedbackModal] react-native-view-shot not available, screenshot feature disabled');
}

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  screenshotRef?: React.RefObject<View>;
}

export function FeedbackModal({ visible, onClose, screenshotRef }: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      Alert.alert('Feedback Required', 'Please enter your feedback before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Collect device info
      const deviceInfo = {
        platform: Platform.OS,
        platformVersion: Platform.Version,
        appVersion: Constants.expoConfig?.version || 'unknown',
        deviceModel: Constants.deviceName,
        timestamp: new Date().toISOString(),
      };

      // Capture screenshot if requested
      let screenshotUri: string | undefined;
      if (includeScreenshot && screenshotRef?.current) {
        try {
          screenshotUri = await captureRef(screenshotRef.current, {
            format: 'jpg',
            quality: 0.8,
          });
        } catch (error) {
          console.warn('Failed to capture screenshot:', error);
        }
      }

      // Send to Sentry User Feedback
      const eventId = Sentry.captureMessage('User Feedback Submitted', {
        level: 'info',
        tags: {
          type: 'user_feedback',
          platform: Platform.OS,
        },
        contexts: {
          device: deviceInfo,
        },
        extra: {
          feedback: feedback.trim(),
          screenshotIncluded: !!screenshotUri,
        },
      });

      // Also submit via Sentry's feedback integration
      Sentry.captureUserFeedback({
        event_id: eventId,
        name: 'Beta Tester',
        email: 'beta@weave.app', // Placeholder
        comments: feedback.trim(),
      });

      // Track analytics
      trackEvent(AnalyticsEvents.FEEDBACK_SUBMITTED, {
        feedback_length: feedback.length,
        has_screenshot: !!screenshotUri,
        platform: Platform.OS,
      });

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your help in making Weave better!',
        [{ text: 'OK', onPress: () => onClose() }]
      );

      setFeedback('');
      setIncludeScreenshot(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Sentry.captureException(error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
    >
      <View className="flex-1">
        <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-6"
          style={{
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 20,
            maxHeight: '80%',
          }}
        >
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text
              style={{ color: colors.foreground }}
              className="font-lora text-[22px] font-bold"
            >
              Send Feedback
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="mb-4 font-inter-regular text-sm"
            >
              Help us improve Weave! Share any bugs, suggestions, or thoughts you have.
              Your feedback is invaluable.
            </Text>

            {/* Feedback Input */}
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="What happened? Any suggestions?"
              placeholderTextColor={colors['muted-foreground']}
              multiline
              numberOfLines={6}
              className="mb-4 rounded-xl p-4 font-inter-regular text-base"
              style={{
                backgroundColor: colors.muted,
                color: colors.foreground,
                textAlignVertical: 'top',
                minHeight: 120,
              }}
            />

            {/* Screenshot Toggle */}
            <TouchableOpacity
              className="mb-4 flex-row items-center justify-between rounded-xl p-4"
              style={{ backgroundColor: colors.muted }}
              onPress={() => setIncludeScreenshot(!includeScreenshot)}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: includeScreenshot
                      ? colors.primary + '20'
                      : colors.background,
                  }}
                >
                  <Camera
                    size={20}
                    color={includeScreenshot ? colors.primary : colors['muted-foreground']}
                  />
                </View>
                <View>
                  <Text
                    className="font-inter-medium text-base"
                    style={{ color: colors.foreground }}
                  >
                    Include Screenshot
                  </Text>
                  <Text
                    className="font-inter-regular text-xs"
                    style={{ color: colors['muted-foreground'] }}
                  >
                    Help us see what you're seeing
                  </Text>
                </View>
              </View>
              <View
                className="h-6 w-6 items-center justify-center rounded"
                style={{
                  backgroundColor: includeScreenshot ? colors.primary : 'transparent',
                  borderWidth: includeScreenshot ? 0 : 2,
                  borderColor: colors.border,
                }}
              >
                {includeScreenshot && <Text style={{ color: colors.card }}>✓</Text>}
              </View>
            </TouchableOpacity>

            {/* Device Info Notice */}
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="mb-6 font-inter-regular text-xs"
            >
              Device info (OS, version, model) will be included automatically to help us debug.
            </Text>

            {/* Submit Button */}
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 rounded-xl py-4"
              style={{
                backgroundColor: isSubmitting ? colors.muted : colors.primary,
                opacity: isSubmitting ? 0.6 : 1,
              }}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Send size={20} color={colors.card} />
              <Text className="font-inter-semibold text-base" style={{ color: colors.card }}>
                {isSubmitting ? 'Sending...' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
