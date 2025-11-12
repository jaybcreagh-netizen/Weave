import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

import { useTheme } from '../../hooks/useTheme';

interface SocialBatterySheetProps {
  isVisible: boolean;
  onSubmit: (value: number, note?: string) => void;
  onDismiss: () => void;
  onViewYearInMoons?: () => void;
}

// Battery level moon phase states with descriptions
const BATTERY_STATES = [
  {
    value: 1,
    emoji: '🌑',
    label: 'New Moon',
    color: '#F87171',
    description: 'Need complete solitude',
    shortDesc: 'Depleted'
  },
  {
    value: 2,
    emoji: '🌘',
    label: 'Waning',
    color: '#FBBF24',
    description: 'Prefer quiet, minimal interaction',
    shortDesc: 'Low'
  },
  {
    value: 3,
    emoji: '🌗',
    label: 'Half Moon',
    color: '#FCD34D',
    description: 'Open to connection',
    shortDesc: 'Balanced'
  },
  {
    value: 4,
    emoji: '🌖',
    label: 'Waxing',
    color: '#6EE7B7',
    description: 'Seeking meaningful connection',
    shortDesc: 'Good'
  },
  {
    value: 5,
    emoji: '🌕',
    label: 'Full Moon',
    color: '#34D399',
    description: 'Craving social interaction',
    shortDesc: 'High'
  },
];

export const SocialBatterySheet: React.FC<SocialBatterySheetProps> = ({
  isVisible,
  onSubmit,
  onDismiss,
}) => {
  const { colors, isDarkMode } = useTheme();
  const [batteryLevel, setBatteryLevel] = useState<number>(3);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const sheetTranslateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  // Animate sheet in/out
  useEffect(() => {
    if (isVisible) {
      // Smooth, gentle animation - no crazy spring!
      sheetTranslateY.value = withSpring(0, {
        damping: 35, // Higher damping = less bouncy
        stiffness: 200,
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      sheetTranslateY.value = withTiming(600, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
      // Reset state after modal is closed
      setTimeout(() => {
        resetState();
      }, 300);
    }
  }, [isVisible]);

  const handleSliderChange = (value: number) => {
    const rounded = Math.round(value);
    setBatteryLevel(rounded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(batteryLevel, note || undefined);
    // Don't reset state here - it will reset when modal closes
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
    // Don't reset state here - it will reset when modal closes
  };

  const resetState = () => {
    setBatteryLevel(3);
    setNote('');
    setShowNoteInput(false);
  };

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const currentState = BATTERY_STATES.find(s => s.value === batteryLevel) || BATTERY_STATES[2];

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} onRequestClose={handleDismiss} animationType="none">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
          <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
          <TouchableOpacity
            className="absolute inset-0"
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            animatedSheetStyle,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          className="absolute bottom-0 left-0 right-0 h-[50vh] rounded-t-3xl border-t px-6 pt-6 pb-10 shadow-2xl"
        >
          {/* Header */}
          <View className="mb-6 items-center">
            <Text
              style={{ color: colors.foreground }}
              className="text-center font-lora text-[22px] font-bold"
            >
              Check in with your social energy
            </Text>
          </View>

          {/* Current State Display */}
          <View className="mb-6 items-center">
            <Text style={{ color: currentState.color }} className="mb-3 text-[64px]">
              {currentState.emoji}
            </Text>
            <Text
              style={{ color: colors.foreground }}
              className="mb-1 font-inter text-xl font-semibold"
            >
              {currentState.shortDesc}
            </Text>
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="font-inter text-sm"
            >
              {currentState.description}
            </Text>
          </View>

          {/* Slider */}
          <View className="mb-6">
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={5}
              step={1}
              value={batteryLevel}
              onValueChange={handleSliderChange}
              minimumTrackTintColor={currentState.color}
              maximumTrackTintColor={colors.border}
              thumbTintColor={currentState.color}
            />
            <View className="flex-row justify-between px-2">
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="font-inter text-xs"
              >
                Depleted
              </Text>
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="font-inter text-xs"
              >
                High
              </Text>
            </View>
          </View>

          {/* Optional Note */}
          {!showNoteInput ? (
            <TouchableOpacity
              onPress={() => setShowNoteInput(true)}
              style={{ borderColor: colors.border }}
              className="mb-6 items-center rounded-xl border border-dashed p-4"
            >
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="font-inter text-sm"
              >
                + Add a note (optional)
              </Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              style={{
                backgroundColor: colors['input-background'],
                color: colors.foreground,
                borderColor: colors.border,
              }}
              className="mb-6 min-h-[80px] rounded-xl border p-4 font-inter text-sm"
              placeholder="How are you feeling?"
              placeholderTextColor={colors['muted-foreground']}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
          )}

          {/* Actions */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDismiss}
              style={{ backgroundColor: colors.muted }}
              className="flex-1 items-center rounded-xl py-4"
            >
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="font-inter text-base font-semibold"
              >
                Skip Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={{ backgroundColor: colors.primary }}
              className="flex-[2] items-center rounded-xl py-4"
            >
              <Text
                style={{ color: colors['primary-foreground'] }}
                className="font-inter text-base font-semibold"
              >
                Check In
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
