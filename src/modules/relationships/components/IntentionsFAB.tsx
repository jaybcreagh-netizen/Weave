import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface IntentionsFABProps {
  count: number;
  onClick: () => void;
}

/**
 * Floating Action Button for intentions
 * Shows in bottom left of friend profile with shooting star icon
 * Displays count badge if there are intentions
 */
export function IntentionsFAB({ count, onClick }: IntentionsFABProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClick();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      className="absolute bottom-6 left-6 z-[1000]"
    >
      <Animated.View
        className="w-14 h-14 rounded-full items-center justify-center shadow-md elevation-8"
        style={[
          {
            backgroundColor: colors.secondary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8
          },
          animatedStyle,
        ]}
      >
        <Sparkles color={colors.foreground} size={26} />
        {count > 0 ? (
          <View className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full items-center justify-center px-1.5" style={{ backgroundColor: colors.primary }}>
            <Text className="text-xs font-bold" style={{ color: colors['primary-foreground'] }}>
              {count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}
