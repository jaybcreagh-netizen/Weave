/**
 * NotificationPermissionModal
 * Modal component to request notification permissions from users
 * Explains the value of notifications and gracefully handles opt-out
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Bell, Calendar, Heart, Sparkles, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

interface NotificationPermissionModalProps {
  visible: boolean;
  onRequestPermission: () => void;
  onSkip: () => void;
}

export function NotificationPermissionModal({
  visible,
  onRequestPermission,
  onSkip,
}: NotificationPermissionModalProps) {
  const handleRequestPermission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRequestPermission();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <Animated.View
          entering={FadeIn.duration(200)}
          className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg overflow-hidden"
          style={{ maxHeight: '80%' }}
        >
          {/* Header */}
          <View className="px-6 pt-6 pb-4">
            <View className="items-center mb-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: `${theme.colors.primary}20` }}
              >
                <Bell size={32} color={theme.colors.primary} />
              </View>
              <Text
                className="text-2xl font-bold text-center mb-2"
                style={{ color: theme.colors.foreground, fontFamily: 'Lora_700Bold' }}
              >
                Stay connected with gentle nudges
              </Text>
              <Text
                className="text-base text-center"
                style={{ color: theme.colors['muted-foreground'] }}
              >
                Weave works best when it can remind you of what matters
              </Text>
            </View>
          </View>

          {/* Benefits List */}
          <ScrollView className="px-6 pb-4" showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-4">
              <NotificationBenefit
                icon={<Calendar size={24} color={theme.colors.primary} />}
                title="Event reminders"
                description="Get a gentle nudge 1 hour before planned connections"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-4">
              <NotificationBenefit
                icon={<Heart size={24} color={theme.colors.primary} />}
                title="Deepen reflections"
                description="Prompts to reflect on meaningful moments after you connect"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-4">
              <NotificationBenefit
                icon={<Sparkles size={24} color={theme.colors.primary} />}
                title="Weekly reflection"
                description="A Sunday evening invitation to reflect on your week"
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-6">
              <NotificationBenefit
                icon={<Bell size={24} color={theme.colors.primary} />}
                title="Memory nudges"
                description="Rediscover reflections from a year ago this week"
              />
            </Animated.View>

            <Text
              className="text-sm text-center italic mb-6"
              style={{ color: theme.colors['muted-foreground'] }}
            >
              You can always customize or disable notifications in Settings
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View className="px-6 pb-6 gap-3">
            <TouchableOpacity
              onPress={handleRequestPermission}
              className="py-4 rounded-2xl items-center"
              style={{ backgroundColor: theme.colors.primary }}
              activeOpacity={0.8}
            >
              <Text className="text-white text-lg font-bold">Enable notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkip}
              className="py-4 rounded-2xl items-center"
              style={{ backgroundColor: theme.colors.muted }}
              activeOpacity={0.7}
            >
              <Text style={{ color: theme.colors['muted-foreground'] }} className="text-base font-semibold">
                Maybe later
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface NotificationBenefitProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function NotificationBenefit({ icon, title, description }: NotificationBenefitProps) {
  return (
    <View className="flex-row items-start gap-4">
      <View
        className="w-12 h-12 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${theme.colors.primary}15` }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-semibold mb-1"
          style={{ color: theme.colors.foreground }}
        >
          {title}
        </Text>
        <Text
          className="text-sm"
          style={{ color: theme.colors['muted-foreground'], lineHeight: 20 }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}
