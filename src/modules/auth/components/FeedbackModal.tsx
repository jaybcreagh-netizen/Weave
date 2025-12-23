import React, { useState } from 'react';
import { View, Platform, Alert, ScrollView } from 'react-native';
import { Send } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useTheme } from '@/shared/hooks/useTheme';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';
import { BottomSheetInput } from '@/shared/ui/BottomSheetInput';
import { Button } from '@/shared/ui/Button';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const { colors } = useTheme();
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

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      height="form"
      title="Send Feedback"
      scrollable
      footerComponent={
        <Button
          label={isSubmitting ? "Submitting..." : "Submit Feedback"}
          onPress={handleSubmit}
          loading={isSubmitting}
          fullWidth
          variant="primary"
          icon={<Send size={20} color={colors['primary-foreground']} />}
        />
      }
    >
      <View className="px-5 pb-5">
        {/* Instructions */}
        <Text
          color="muted"
          className="mb-4"
        >
          Help us improve Weave! Share any bugs, suggestions, or thoughts you have.
          Your feedback is invaluable.
        </Text>

        {/* Feedback Input */}
        <BottomSheetInput
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
      </View>
    </StandardBottomSheet>
  );
}
