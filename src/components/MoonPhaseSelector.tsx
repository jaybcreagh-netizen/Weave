import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { type Vibe } from './types';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import Phase1 from '@/assets/MoonIcons/Phase1.svg';
import Phase2 from '@/assets/MoonIcons/Phase2.svg';
import Phase3 from '@/assets/MoonIcons/Phase3.svg';
import Phase4 from '@/assets/MoonIcons/Phase4.svg';
import Phase5 from '@/assets/MoonIcons/Phase5.svg';

const MOON_SVG_MAP: Record<Vibe, React.FC<any>> = {
  NewMoon: Phase1,
  WaxingCrescent: Phase2,
  FirstQuarter: Phase3,
  WaxingGibbous: Phase4,
  FullMoon: Phase5,
  WaningGibbous: Phase4,
  LastQuarter: Phase3,
  WaningCrescent: Phase2,
};

const PHASE_DESCRIPTIONS: Record<Vibe, { title: string; description: string }> = {
  NewMoon: {
    title: 'New Moon',
    description: "A quiet moment. Not every thread needs to\u00A0spark.\nSometimes you just cross paths. That's\u00A0okay."
  },
  WaxingCrescent: {
    title: 'Waxing Crescent',
    description: "A small connection. It still\u00A0counts.\nLight touch, but you showed\u00A0up."
  },
  FirstQuarter: {
    title: 'Half Moon',
    description: "A good moment. The kind friendships are built\u00A0on.\nNothing dramatic. Just real time\u00A0together."
  },
  WaxingGibbous: {
    title: 'Waxing Gibbous',
    description: "That one landed. You'll carry a bit of it with\u00A0you.\nA warm one. These add\u00A0up."
  },
  FullMoon: {
    title: 'Full Moon',
    description: "You felt it. So did they,\u00A0probably.\nThe kind of moment you'll\u00A0remember."
  },
  // Fallbacks
  WaningGibbous: { title: 'Waning Gibbous', description: '' },
  LastQuarter: { title: 'Last Quarter', description: '' },
  WaningCrescent: { title: 'Waning Crescent', description: '' },
};

// Numeric mapping for slider (1-5)
const VIBE_ORDER: Vibe[] = [
  'NewMoon',
  'WaxingCrescent',
  'FirstQuarter',
  'WaxingGibbous',
  'FullMoon'
];

interface MoonPhaseSelectorProps {
  onSelect: (vibe: Vibe) => void;
  selectedVibe: Vibe | null;
}

export function MoonPhaseSelector({ onSelect, selectedVibe }: MoonPhaseSelectorProps) {
  // Determine current numeric value from selectedVibe, default to 3 (FirstQuarter) if null
  const currentIndex = selectedVibe ? VIBE_ORDER.indexOf(selectedVibe) : 2;
  const sliderValue = currentIndex !== -1 ? currentIndex + 1 : 3;

  // Local state for display text to allow animating out before changing
  const currentVibe = selectedVibe || 'FirstQuarter';

  // We use a ref to track the "active" vibe for text display, which updates AFTER fade out
  const [displayedVibe, setDisplayedVibe] = React.useState(currentVibe);

  // Opacity shared values
  const textOpacity = useSharedValue(1);
  const iconScale = useSharedValue(1);

  React.useEffect(() => {
    if (currentVibe !== displayedVibe) {
      // 1. Fade out
      textOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) {
          // 2. Swap text (run on JS thread)
          runOnJS(setDisplayedVibe)(currentVibe);
        }
      });
      // Pop icon slightly
      iconScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withTiming(1, { duration: 150 })
      );
    }
  }, [currentVibe]);

  // When displayedVibe updates (after fade out), fade back in
  React.useEffect(() => {
    if (textOpacity.value === 0) {
      textOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [displayedVibe]);

  const handleSliderChange = (value: number) => {
    const index = Math.round(value) - 1;
    const newVibe = VIBE_ORDER[index];
    if (newVibe && newVibe !== selectedVibe) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(newVibe);
    }
  };

  const MoonIcon = MOON_SVG_MAP[currentVibe] || Phase3; // Icon updates immediately for responsiveness
  const phaseInfo = PHASE_DESCRIPTIONS[displayedVibe] || PHASE_DESCRIPTIONS['FirstQuarter']; // Text updates after fade

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }]
  }));

  return (
    <View style={styles.container}>
      {/* Icon Display */}
      <View style={styles.iconContainer}>
        <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
          <MoonIcon width={64} height={64} color={theme.colors.primary} fill={theme.colors.primary} />
        </Animated.View>

        <View style={styles.textContainer}>
          <Animated.View style={textAnimatedStyle}>
            <Text style={styles.label}>{phaseInfo.title}</Text>
          </Animated.View>

          <View style={styles.descriptionWrapper}>
            <Animated.Text style={[styles.description, textAnimatedStyle]}>
              {phaseInfo.description.split('\n')[0]}
            </Animated.Text>

            {phaseInfo.description.split('\n')[1] && (
              <Animated.Text
                style={[styles.description, textAnimatedStyle, { marginTop: 4, opacity: 0.8 }]} // Base opacity handled by parent, but we can stack or just use textOpacity
              >
                {phaseInfo.description.split('\n')[1]}
              </Animated.Text>
            )}
          </View>
        </View>
      </View>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={1}
          maximumValue={5}
          step={1}
          value={sliderValue}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.border}
          thumbTintColor={theme.colors.primary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    gap: 24,
    paddingVertical: 12,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 200, // Fixed height to prevent slider jumping
    gap: 16,
    width: '100%',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    height: 80,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    gap: 8,
  },
  descriptionWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 20,
    fontFamily: 'Lora-Bold',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors['muted-foreground'],
    textAlign: 'center',
    lineHeight: 20,
  },
  sliderContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sliderLabelText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors['muted-foreground'],
  },
});

