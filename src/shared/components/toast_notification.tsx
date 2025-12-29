import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Sparkles } from 'lucide-react-native';
import { Portal } from '@gorhom/portal';
import { useTheme } from '@/shared/hooks/useTheme';

interface ToastNotificationProps {
  message: string;
  friendName: string;
  onDismiss: () => void;
}

export function ToastNotification({ message, friendName, onDismiss }: ToastNotificationProps) {
  const { colors, isDarkMode } = useTheme();

  // Animation values
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    // Entrance animation: Pop in
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    // Auto dismiss
    const timer = setTimeout(() => {
      // Exit animation: Drop down and fade out
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      });
      translateY.value = withTiming(10, { duration: 200 });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Portal hostName="toast_layer">
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}
        pointerEvents="box-none"
      >
        <Animated.View style={[{
          borderRadius: 24,
          overflow: 'hidden',
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 12,
        }, animatedStyle]}>
          {/* Glassmorphic Background */}
          <View className="absolute inset-0">
            <BlurView
              intensity={isDarkMode ? 40 : 60}
              tint={isDarkMode ? 'dark' : 'light'}
              className="absolute inset-0"
            />
            {/* Subtle background overlay for better visibility */}
            <View
              className="absolute inset-0"
              style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)' }}
            />
          </View>

          {/* Content */}
          <View className="flex-row items-center p-5 pr-7 min-w-[260px] max-w-[85%] gap-4">
            <View className="w-12 h-12 rounded-full justify-center items-center" style={[{ backgroundColor: colors.primary }, {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }]}>
              <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />
            </View>

            <View className="flex-1 justify-center">
              <Text className="text-[17px] mb-0.5 tracking-tight" style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {message}
              </Text>
              {friendName && (
                <Text className="text-[15px]" style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}>
                  with <Text style={{ color: colors.primary, fontFamily: 'Lora_700Bold' }}>{friendName}</Text>
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Portal>
  );
}