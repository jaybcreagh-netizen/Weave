import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { theme } from '../theme';

interface ToastNotificationProps {
  message: string;
  friendName: string;
  onDismiss: () => void;
}

export function ToastNotification({ message, friendName, onDismiss }: ToastNotificationProps) {
  const insets = useSafeAreaInsets();
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
      style={[
        styles.container, 
        { top: insets.top + 12 },
        animatedStyle
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>✓</Text>
        <View style={styles.textContainer}>
          <Text style={styles.message}>
            <Text style={styles.activityText}>{message}</Text>
            <Text style={styles.withText}> logged with </Text>
            <Text style={styles.friendNameText}>{friendName}</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(181, 138, 108, 0.3)',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 15,
    lineHeight: 20,
  },
  activityText: {
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  withText: {
    fontWeight: '400',
    color: theme.colors['muted-foreground'],
  },
  friendNameText: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: 'Lora_700Bold',
  },
});