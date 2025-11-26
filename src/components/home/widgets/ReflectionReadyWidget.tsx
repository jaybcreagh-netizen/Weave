/**
 * ReflectionReadyWidget
 * Widget shown in Insights tab when weekly reflection is due
 * Gentle reminder with tap-to-start action
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface ReflectionReadyWidgetProps {
  onPress?: () => void;
}

export function ReflectionReadyWidget({ onPress }: ReflectionReadyWidgetProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="mx-5 mb-4 rounded-3xl overflow-hidden"
      style={{ backgroundColor: colors.card }}
    >
      {/* Gradient background effect */}
      <View
        className="absolute inset-0 opacity-10"
        style={{ backgroundColor: colors.primary }}
      />

      <View className="p-6 flex-row items-center">
        {/* Icon */}
        <View
          className="w-14 h-14 rounded-full items-center justify-center mr-4"
          style={{ backgroundColor: colors.primary + '20' }}
        >
          <Sparkles size={24} color={colors.primary} />
        </View>

        {/* Text Content */}
        <View className="flex-1">
          <Text
            className="text-lg font-semibold mb-1"
            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
          >
            Your weekly reflection is ready
          </Text>
          <Text
            className="text-sm"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Tap to reflect on this week's connections
          </Text>
        </View>

        {/* Arrow indicator */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18 }}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
