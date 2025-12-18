import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    <Portal>
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View style={[styles.wrapper, animatedStyle]}>
          {/* Glassmorphic Background */}
          <View style={styles.blurContainer}>
            <BlurView
              intensity={isDarkMode ? 40 : 60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            {/* Subtle background overlay for better visibility */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)' }
              ]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.message, { color: colors.foreground }]}>
                {message}
              </Text>
              {friendName && (
                <Text style={[styles.friendName, { color: colors['muted-foreground'] }]}>
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

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  wrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingRight: 28,
    minWidth: 260,
    maxWidth: '85%',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  friendName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  }
});