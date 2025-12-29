import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
    label: 'New Moon',
    color: '#F87171',
    description: 'Need complete solitude',
    shortDesc: 'Depleted'
  },
  {
    value: 2,
    label: 'Waning',
    color: '#FBBF24',
    description: 'Prefer quiet, minimal interaction',
    shortDesc: 'Low'
  },
  {
    value: 3,
    label: 'Half Moon',
    color: '#FCD34D',
    description: 'Open to connection',
    shortDesc: 'Balanced'
  },
  {
    value: 4,
    label: 'Waxing',
    color: '#6EE7B7',
    description: 'Seeking meaningful connection',
    shortDesc: 'Good'
  },
  {
    value: 5,
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
  const { colors } = useTheme();
  const [batteryLevel, setBatteryLevel] = useState<number>(3);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleSliderChange = (value: number) => {
    const rounded = Math.round(value);
    setBatteryLevel(rounded);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Reset state when sheet opens to ensure slider starts at center
  useEffect(() => {
    if (isVisible) {
      setBatteryLevel(3);
      setNote('');
      setShowNoteInput(false);
    }
  }, [isVisible]);

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(batteryLevel, note || undefined);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const resetState = () => {
    setBatteryLevel(3);
    setNote('');
    setShowNoteInput(false);
  };

  const currentState = BATTERY_STATES.find(s => s.value === batteryLevel) || BATTERY_STATES[2];

  return (
    <AnimatedBottomSheet
      visible={isVisible}
      onClose={handleDismiss}
      onCloseComplete={resetState}
      height="form"
      scrollable
      springConfig={{
        damping: 18,
        stiffness: 120,
      }}
    >
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600).springify()}
        className="mb-6 items-center"
      >
        <Text
          style={{ color: colors.foreground }}
          className="text-center font-lora text-[22px] font-bold"
        >
          Check in with your social energy
        </Text>
      </Animated.View>

      {/* Current State Display */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(600).springify()}
        className="mb-6 items-center"
      >
        <View className="mb-3">
          <MoonPhaseIllustration
            phase={0}
            batteryLevel={currentState.value}
            size={80}
            color={currentState.color}
            hasCheckin={true}
          />
        </View>
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
      </Animated.View>

      {/* Slider */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(600).springify()}
        className="mb-6"
      >
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
      </Animated.View>

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
      <Animated.View
        entering={FadeInDown.delay(400).duration(600).springify()}
        className="flex-row gap-3"
      >
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
      </Animated.View>
    </AnimatedBottomSheet>
  );
};
