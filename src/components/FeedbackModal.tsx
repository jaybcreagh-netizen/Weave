import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/shared/hooks/useTheme';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        platform: Platform.OS,
      });

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your help in making Weave better!',
        [{ text: 'OK', onPress: () => onClose() }]
      );

      setFeedback('');
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
