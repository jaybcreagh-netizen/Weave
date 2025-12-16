import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';

interface ToastNotificationProps {
  message: string;
  friendName: string;
  onDismiss: () => void;
}

export function ToastNotification({ message, friendName, onDismiss }: ToastNotificationProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Slide in
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto dismiss after 2.5 seconds
    const timer = setTimeout(() => {
      translateY.value = withTiming(-100, { duration: 250 });
      opacity.value = withTiming(0, { duration: 250 });
      setTimeout(onDismiss, 250);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="absolute left-5 right-5 z-[9999]"
      style={[
        { top: insets.top + 12 },
        animatedStyle
      ]}
    >
      <View
        className="flex-row items-center rounded-2xl p-4 py-3.5 shadow-lg border-[1.5px]"
        style={{
          backgroundColor: isDarkMode ? colors.card : 'rgba(255, 255, 255, 0.95)',
          borderColor: colors.primary + '4D', // 30% roughly 4D hex
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text className="text-2xl mr-3" style={{ color: colors.foreground }}>✓</Text>
        <View className="flex-1">
          <Text className="text-[15px] leading-5" style={{ color: colors.foreground }}>
            <Text className="font-bold">{message}</Text>
            <Text className="font-normal" style={{ color: colors['muted-foreground'] }}> logged with </Text>
            <Text className="font-bold font-lora-bold" style={{ color: colors.primary }}>{friendName}</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}