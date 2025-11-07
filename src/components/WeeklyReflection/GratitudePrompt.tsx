/**
 * GratitudePrompt Component
 * Gratitude journaling for weekly reflection
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sparkles, Check } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import * as Haptics from 'expo-haptics';

interface GratitudePromptProps {
  onComplete: (gratitudeText: string) => void;
}

const PROMPTS = [
  "What moment with a friend made you smile this week?",
  "Which friendship brought you joy recently?",
  "What are you grateful for in your relationships?",
  "Who showed up for you this week?",
  "What connection surprised or delighted you?",
];

export function GratitudePrompt({ onComplete }: GratitudePromptProps) {
  const { colors } = useTheme();
  const [gratitudeText, setGratitudeText] = useState('');
  const [selectedPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(gratitudeText);
  };

  const canComplete = gratitudeText.trim().length > 0 || true; // Allow skipping

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeIn} className="mb-6 items-center">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Sparkles size={32} color={colors.primary} />
          </View>
          <Text
            className="text-2xl font-bold text-center mb-2"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            Moment of Gratitude
          </Text>
          <Text
            className="text-sm text-center leading-5 px-6"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Take a moment to reflect on the connections that nourished you.
          </Text>
        </Animated.View>

        {/* Prompt Card */}
        <Animated.View
          entering={FadeIn.delay(100)}
          className="mb-6 p-6 rounded-2xl"
          style={{ backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30', borderWidth: 1 }}
        >
          <Text
            className="text-base leading-6 text-center italic"
            style={{ color: colors.foreground, fontFamily: 'Lora_400Regular' }}
          >
            "{selectedPrompt}"
          </Text>
        </Animated.View>

        {/* Text Input */}
        <Animated.View
          entering={FadeIn.delay(200)}
          className="mb-6"
        >
          <TextInput
            value={gratitudeText}
            onChangeText={setGratitudeText}
            placeholder="Write what comes to mind..."
            placeholderTextColor={colors['muted-foreground']}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            className="p-4 rounded-xl text-base min-h-[160px]"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              color: colors.foreground,
              fontFamily: 'Inter_400Regular',
            }}
          />
          <Text
            className="text-xs mt-2 px-1"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Optional • Your reflections are private
          </Text>
        </Animated.View>

        {/* Benefits Card */}
        <Animated.View
          entering={FadeIn.delay(300)}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-xs font-semibold mb-2"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            💡 WHY GRATITUDE MATTERS
          </Text>
          <Text
            className="text-xs leading-5"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Reflecting on positive moments strengthens your relationships and increases your sense of connection. Regular gratitude practice has been shown to improve emotional well-being and relationship satisfaction.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Complete Button */}
      <Animated.View entering={FadeIn.delay(400)} className="pt-4">
        <TouchableOpacity
          onPress={handleComplete}
          disabled={!canComplete}
          className="py-4 rounded-xl items-center flex-row justify-center"
          style={{
            backgroundColor: canComplete ? colors.primary : colors.muted,
            opacity: canComplete ? 1 : 0.5,
          }}
        >
          <Check size={20} color={colors['primary-foreground']} />
          <Text
            className="text-base font-semibold ml-2"
            style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            {gratitudeText.trim().length > 0 ? 'Complete Reflection' : 'Complete Without Writing'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
