/**
 * ReflectionReadyPrompt
 * Gentle centered card popup asking if user is ready for weekly reflection
 * Shows "Remind me later" and "Let's Go" options
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface ReflectionReadyPromptProps {
  isVisible: boolean;
  onStart: () => void;
  onRemindLater: () => void;
  onDismiss: () => void;
}

export function ReflectionReadyPrompt({
  isVisible,
  onStart,
  onRemindLater,
  onDismiss,
}: ReflectionReadyPromptProps) {
  const { colors } = useTheme();

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStart();
  };

  const handleRemindLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemindLater();
  };

  const handleBackdropPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      {/* Backdrop */}
      <Pressable
        onPress={handleBackdropPress}
        className="flex-1 items-center justify-center bg-black/50"
      >
        {/* Card */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mx-6 rounded-3xl overflow-hidden shadow-xl"
          style={{ backgroundColor: colors.card, maxWidth: 400 }}
        >
          {/* Icon & Title */}
          <View className="items-center pt-8 px-6">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: colors.primary + '20' }}
            >
              <Sparkles size={32} color={colors.primary} />
            </View>

            <Text
              className="text-2xl font-semibold text-center mb-2"
              style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
            >
              Ready for your weekly reflection?
            </Text>

            <Text
              className="text-base text-center mb-6"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              Take 2 minutes to reflect on your friendships this week
            </Text>
          </View>

          {/* Actions */}
          <View className="px-6 pb-6 gap-3">
            {/* Primary Action - Let's Go */}
            <TouchableOpacity
              onPress={handleStart}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' }}
              >
                Let's Go
              </Text>
            </TouchableOpacity>

            {/* Secondary Actions Row */}
            <View className="flex-row gap-3">
              {/* Remind Later */}
              <TouchableOpacity
                onPress={handleRemindLater}
                className="flex-1 rounded-2xl py-3 items-center"
                style={{ backgroundColor: colors.muted }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  Remind me later
                </Text>
              </TouchableOpacity>

              {/* Not Today */}
              <TouchableOpacity
                onPress={handleBackdropPress}
                className="flex-1 rounded-2xl py-3 items-center"
                style={{ backgroundColor: colors.muted }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                  Not today
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
