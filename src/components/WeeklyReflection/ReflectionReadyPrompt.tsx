/**
 * ReflectionReadyPrompt
 * Gentle centered card popup asking if user is ready for weekly reflection
 * Shows "Remind me later" and "Let's Go" options
 */

import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/shared/ui/Card';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';

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
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Card className="mx-6 w-[90%] max-w-[400px] overflow-hidden">
            {/* Icon & Title */}
            <View className="items-center pt-8 px-6">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <Sparkles size={32} color={colors.primary} />
              </View>

              <Text variant="h2" className="text-center mb-2">
                Ready for your weekly reflection?
              </Text>

              <Text variant="body" className="text-center mb-6 text-muted-foreground">
                Take 2 minutes to reflect on your friendships this week
              </Text>
            </View>

            {/* Actions */}
            <View className="px-6 pb-6 gap-3">
              {/* Primary Action - Let's Go */}
              <Button
                onPress={handleStart}
                variant="primary"
                className="w-full"
              >
                Let's Go
              </Button>

              {/* Secondary Actions Row */}
              <View className="flex-row gap-3">
                {/* Remind Later */}
                <Button
                  onPress={handleRemindLater}
                  variant="secondary"
                  className="flex-1"
                >
                  Remind me later
                </Button>

                {/* Not Today */}
                <Button
                  onPress={handleBackdropPress}
                  variant="secondary"
                  className="flex-1"
                >
                  Not today
                </Button>
              </View>
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
