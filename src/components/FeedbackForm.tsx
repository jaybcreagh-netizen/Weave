import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Share, Platform, ScrollView } from 'react-native';
import { Send, X, Camera, CheckCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { captureRef } from 'react-native-view-shot';
import { database } from '../db';
import { exportErrorLogs } from '../lib/error-logger';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_STORAGE_KEY = '@weave:feedback_submissions';

interface FeedbackFormProps {
  onClose: () => void;
  onSubmit?: (feedback: string) => void;
}

export function FeedbackForm({ onClose, onSubmit }: FeedbackFormProps) {
  const { colors } = useTheme();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const collectDiagnosticData = async () => {
    try {
      // Collect database stats
      const friendsCount = await database.get('friends').query().fetchCount();
      const interactionsCount = await database.get('interactions').query().fetchCount();
      const intentionsCount = await database.get('intentions').query().fetchCount();

      // Get error logs
      const errorLogs = await exportErrorLogs();

      // Build diagnostic report
      const diagnostics = `
╔════════════════════════════════════════════════════════════╗
║                   WEAVE FEEDBACK REPORT                    ║
╚════════════════════════════════════════════════════════════╝

📱 DEVICE INFO
─────────────────────────────────────────────────────────────
Version: ${Constants.expoConfig?.version || 'Unknown'}
Build: ${Constants.expoConfig?.android?.versionCode || Constants.expoConfig?.ios?.buildNumber || 'Unknown'}
Platform: ${Platform.OS} ${Platform.Version}
Device: ${Constants.deviceName || 'Unknown'}
Timestamp: ${new Date().toLocaleString()}

📊 DATABASE STATS
─────────────────────────────────────────────────────────────
Friends: ${friendsCount}
Interactions: ${interactionsCount}
Intentions: ${intentionsCount}

💬 USER FEEDBACK
─────────────────────────────────────────────────────────────
${feedback || '(No feedback provided)'}

⚠️ ERROR LOGS (Last 50)
─────────────────────────────────────────────────────────────
${errorLogs}

═════════════════════════════════════════════════════════════
End of Feedback Report
`.trim();

      return diagnostics;
    } catch (error) {
      console.error('[FeedbackForm] Error collecting diagnostics:', error);
      return `Error collecting diagnostics: ${error}`;
    }
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      Alert.alert('No Feedback', 'Please enter some feedback before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      // Collect all diagnostic data
      const diagnostics = await collectDiagnosticData();

      // Save feedback locally
      try {
        const existingFeedback = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
        const feedbackHistory = existingFeedback ? JSON.parse(existingFeedback) : [];
        feedbackHistory.push({
          feedback,
          timestamp: Date.now(),
          diagnostics,
        });
        await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedbackHistory));
      } catch (storageError) {
        console.error('[FeedbackForm] Failed to save feedback locally:', storageError);
      }

      // Share or copy to clipboard
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message: diagnostics,
          title: 'Weave Beta Feedback',
        });
      } else {
        await Clipboard.setStringAsync(diagnostics);
        Alert.alert('Copied', 'Feedback report copied to clipboard');
      }

      // Call optional submit handler
      if (onSubmit) {
        onSubmit(feedback);
      }

      // Show success state
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('[FeedbackForm] Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <View className="bg-green-500/10 p-4 rounded-full mb-4">
          <CheckCircle size={48} color="#10b981" />
        </View>
        <Text className="text-white text-xl font-semibold mb-2">Thank You!</Text>
        <Text className="text-neutral-400 text-center">
          Your feedback helps us improve Weave
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-white text-xl font-bold">Send Feedback</Text>
          <Text className="text-neutral-400 text-sm mt-1">
            Help us improve Weave
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} className="p-2">
          <X size={24} color={colors['muted-foreground']} />
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mb-4">
        <Text className="text-indigo-300 text-sm">
          Your feedback will include app diagnostics, error logs, and device info to help us debug issues faster.
        </Text>
      </View>

      {/* Feedback Input */}
      <ScrollView className="flex-1 mb-4">
        <Text className="text-white text-sm font-medium mb-2">
          What would you like to share?
        </Text>
        <TextInput
          className="bg-neutral-800 rounded-lg p-4 text-white text-base"
          style={{
            minHeight: 150,
            color: colors.foreground,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          placeholder="Describe a bug, suggest a feature, or share your thoughts..."
          placeholderTextColor={colors['muted-foreground']}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          value={feedback}
          onChangeText={setFeedback}
          autoFocus
        />

        {/* What's Included Info */}
        <View className="mt-4 space-y-2">
          <Text className="text-neutral-500 text-xs font-medium mb-2">
            Automatically included:
          </Text>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-neutral-600 mr-2" />
            <Text className="text-neutral-500 text-xs">App version and device info</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-neutral-600 mr-2" />
            <Text className="text-neutral-500 text-xs">Database statistics</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-neutral-600 mr-2" />
            <Text className="text-neutral-500 text-xs">Recent error logs (if any)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-neutral-600 mr-2" />
            <Text className="text-neutral-500 text-xs">No personal data or friend names</Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting || !feedback.trim()}
        className={`rounded-xl p-4 flex-row items-center justify-center ${
          submitting || !feedback.trim() ? 'bg-neutral-700' : 'bg-indigo-600'
        }`}
      >
        <Send size={20} color="white" />
        <Text className="text-white font-semibold ml-2">
          {submitting ? 'Sending...' : 'Send Feedback'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
