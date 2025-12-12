import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/shared/hooks/useTheme';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';

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
            <Text variant="h2" weight="bold">
              Send Feedback
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instructions */}
            <Text
              color="muted"
              className="mb-4"
            >
              Help us improve Weave! Share any bugs, suggestions, or thoughts you have.
              Your feedback is invaluable.
            </Text>

            {/* Feedback Input */}
            <Input
              value={feedback}
              onChangeText={setFeedback}
              placeholder="What happened? Any suggestions?"
              multiline
              numberOfLines={6}
              style={{
                minHeight: 120,
                textAlignVertical: 'top',
                paddingTop: 12,
              }}
              containerClassName="mb-4"
            />

            {/* Device Info Notice */}
            <Text
              variant="caption"
              color="muted"
              className="mb-6"
            >
              Device info (OS, version, model) will be included automatically to help us debug.
            </Text>

            {/* Submit Button */}
            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={isSubmitting}
              fullWidth
              icon={<Send size={20} color={colors['primary-foreground']} />}
              label="Submit Feedback"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
