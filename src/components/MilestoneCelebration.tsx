import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { Milestone } from '@/modules/gamification';
import * as Haptics from 'expo-haptics';

/**
 * Milestone Celebration Modal
 *
 * Full-screen celebration when user unlocks a milestone.
 * Philosophy: Joyful, meaningful, not gamified/cheap.
 *
 * Animation sequence:
 * 1. Fade in backdrop
 * 2. Scale + fade in milestone icon (burst effect)
 * 3. Slide up milestone name
 * 4. Fade in description
 * 5. Show continue button
 */

interface MilestoneCelebrationProps {
  visible: boolean;
  milestone: Milestone | null;
  onClose: () => void;
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  visible,
  milestone,
  onClose,
}) => {
  const { colors } = useTheme();

  // Animated values
  const backdropOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const titleOpacity = useSharedValue(0);
  const descTranslateY = useSharedValue(20);
  const descOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && milestone) {
      // Trigger haptic celebration
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate in sequence
      backdropOpacity.value = withTiming(1, { duration: 300 });

      iconScale.value = withDelay(
        200,
        withSequence(
          withSpring(1.3, { damping: 8, stiffness: 100 }),
          withSpring(1, { damping: 12, stiffness: 150 })
        )
      );
      iconOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

      titleTranslateY.value = withDelay(
        500,
        withSpring(0, { damping: 15, stiffness: 120 })
      );
      titleOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));

      descTranslateY.value = withDelay(
        700,
        withSpring(0, { damping: 15, stiffness: 120 })
      );
      descOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));

      buttonOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    } else {
      // Reset for next time
      backdropOpacity.value = 0;
      iconScale.value = 0;
      iconOpacity.value = 0;
      titleTranslateY.value = 20;
      titleOpacity.value = 0;
      descTranslateY.value = 20;
      descOpacity.value = 0;
      buttonOpacity.value = 0;
    }
  }, [visible, milestone]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
    opacity: titleOpacity.value,
  }));

  const descStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: descTranslateY.value }],
    opacity: descOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  if (!visible || !milestone) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        className="absolute inset-0"
        style={[
          {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
          },
          backdropStyle,
        ]}
      />

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        {/* Icon Burst */}
        <Animated.View
          className="items-center justify-center mb-8"
          style={iconStyle}
        >
          <View
            className="w-32 h-32 rounded-full items-center justify-center"
            style={{
              backgroundColor: `${colors.primary}15`,
              borderWidth: 2,
              borderColor: `${colors.primary}40`,
            }}
          >
            <Text className="text-[64px]">{milestone.icon}</Text>
          </View>
        </Animated.View>

        {/* Milestone Name */}
        <Animated.View style={titleStyle} className="mb-3">
          <Text
            className="font-lora-bold text-3xl text-center"
            style={{ color: colors.foreground }}
          >
            {milestone.name}
          </Text>
        </Animated.View>

        {/* Description */}
        <Animated.View style={descStyle} className="mb-8">
          <Text
            className="font-inter-regular text-base text-center leading-6"
            style={{ color: colors['muted-foreground'] }}
          >
            {milestone.description}
          </Text>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View style={buttonStyle} className="w-full">
          <TouchableOpacity
            className="py-4 px-8 rounded-2xl items-center"
            style={{ backgroundColor: colors.primary }}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text className="font-inter-semibold text-base text-white">
              Continue Weaving
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};
