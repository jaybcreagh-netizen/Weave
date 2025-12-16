import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Sparkles, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'reflection-ready',
  type: 'reflection-ready',
  title: 'Reflection Ready',
  fullWidth: true,
};

interface ReflectionReadyWidgetProps {
  onPress?: () => void;
}

export function ReflectionReadyWidget({ onPress }: ReflectionReadyWidgetProps) {
  const { tokens, typography } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        className="p-4"
      >
        <View className="flex-row items-center gap-4">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: tokens.primary + '20' }}
          >
            <Sparkles size={24} color={tokens.primary} />
          </View>

          <View className="flex-1">
            <Text
              className="mb-1"
              style={{
                color: tokens.foreground,
                fontFamily: typography.fonts.serifBold,
                fontSize: typography.scale.h3.fontSize,
                lineHeight: typography.scale.h3.lineHeight
              }}
            >
              Your weekly reflection is ready
            </Text>
            <Text
              style={{
                color: tokens.foregroundMuted,
                fontFamily: typography.fonts.sans,
                fontSize: typography.scale.body.fontSize,
                lineHeight: typography.scale.body.lineHeight
              }}
            >
              Tap to reflect on this week's connections
            </Text>
          </View>

          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: tokens.primary }}
          >
            <ArrowRight size={16} color={tokens.primaryForeground} />
          </View>
        </View>
      </TouchableOpacity>
    </HomeWidgetBase>
  );
}

