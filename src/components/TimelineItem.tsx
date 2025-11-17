import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);

import { useTheme } from '@/shared/hooks/useTheme';
import { formatPoeticDate, calculateWeaveWarmth, getThreadColors } from '../lib/timeline-utils';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '../lib/interaction-categories';
import { type Interaction, type InteractionCategory } from './types';
import { calculateDeepeningLevel, getDeepeningVisuals } from '../lib/deepening-utils';
import { usePausableAnimation } from '@/shared/hooks/usePausableAnimation';
import { useUIStore } from '../stores/uiStore';

interface TimelineItemProps {
  interaction: Interaction;
  isFuture: boolean;
  onPress: () => void;
  index: number;
  scrollY?: Animated.SharedValue<number>;
  itemY?: number;
  showKnot?: boolean;
  sectionLabel?: string;
  isFirstInSection?: boolean;
  isLastItem?: boolean; // Is this the last item in the entire timeline?
}

export const TimelineItem = React.memo(({ interaction, isFuture, onPress, index, scrollY, itemY = 0, showKnot = true, sectionLabel, isFirstInSection = false, isLastItem = false }: TimelineItemProps) => {
  const { colors, isDarkMode } = useTheme();
  const { justLoggedInteractionId, setJustLoggedInteractionId } = useUIStore();

  // Memoize date parsing
  const date = useMemo(() =>
    typeof interaction.interactionDate === 'string'
      ? new Date(interaction.interactionDate)
      : interaction.interactionDate,
    [interaction.interactionDate]
  );

  // Memoize expensive calculations
  const warmth = useMemo(() => calculateWeaveWarmth(date), [date]);
  const threadColors = useMemo(() => getThreadColors(warmth, isFuture), [warmth, isFuture]);
  const poeticDate = useMemo(() => formatPoeticDate(date), [date]);
  const { primary, secondary } = poeticDate;

  // All lines are dashed for a more subtle, lightweight appearance
  const lineOpacity = useMemo(() => {
    // Future plans: lighter/more transparent
    if (isFuture) return 0.5;
    // Past: subtle but visible
    return 0.7;
  }, [isFuture]);

  // Get temporal colors (line and knot) with gradient (golden → amber → white)
  const temporalColors = useMemo(() => {
    if (isFuture) {
      // Future plans: lighter, muted
      return {
        line: isDarkMode ? 'rgba(139, 92, 246, 0.4)' : 'rgba(181, 138, 108, 0.35)',
        knot: 'transparent', // Hollow for future
        glow: isDarkMode ? colors.accent : colors.glow,
      };
    }

    const today = new Date();
    const daysAgo = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (!isDarkMode) {
      // Light mode: Temporal gradient from golden to white
      if (daysAgo <= 3) {
        // Recent: Rich golden
        return {
          line: 'rgba(212, 175, 55, 0.9)', // #D4AF37 golden
          knot: 'rgba(212, 175, 55, 0.15)', // Subtle golden tint
          glow: '#D4AF37',
        };
      } else if (daysAgo <= 14) {
        // Medium recent: Amber/bronze
        return {
          line: 'rgba(181, 138, 108, 0.75)',
          knot: 'rgba(181, 138, 108, 0.1)',
          glow: '#B58A6C',
        };
      } else if (daysAgo <= 30) {
        // Older: Light gray-brown
        return {
          line: 'rgba(160, 140, 130, 0.55)',
          knot: 'rgba(160, 140, 130, 0.08)',
          glow: '#A08C82',
        };
      } else {
        // Distant memory: Very light gray, fading to white
        return {
          line: 'rgba(200, 195, 190, 0.35)',
          knot: colors.card, // Pure card color, fully faded
          glow: '#C8C3BE',
        };
      }
    } else {
      // Dark mode: Similar gradient with purple tones
      if (daysAgo <= 3) {
        // Recent: Vibrant accent
        return {
          line: 'rgba(139, 92, 246, 0.9)',
          knot: 'rgba(139, 92, 246, 0.15)',
          glow: colors.accent,
        };
      } else if (daysAgo <= 14) {
        // Medium recent: Medium purple
        return {
          line: 'rgba(139, 92, 246, 0.7)',
          knot: 'rgba(139, 92, 246, 0.1)',
          glow: colors.accent,
        };
      } else if (daysAgo <= 30) {
        // Older: Muted purple
        return {
          line: 'rgba(120, 100, 200, 0.5)',
          knot: 'rgba(120, 100, 200, 0.08)',
          glow: '#7864C8',
        };
      } else {
        // Distant memory: Very faint
        return {
          line: 'rgba(100, 90, 150, 0.3)',
          knot: colors.card, // Pure card color, fully faded
          glow: '#645A96',
        };
      }
    }
  }, [date, isFuture, isDarkMode, colors]);

  // Memoize deepening calculations
  const deepeningMetrics = useMemo(() =>
    calculateDeepeningLevel(interaction.reflection),
    [interaction.reflection]
  );
  const deepeningVisuals = useMemo(() =>
    getDeepeningVisuals(deepeningMetrics, colors, isDarkMode),
    [deepeningMetrics, colors, isDarkMode]
  );

  // Helper to convert opacity (0-1) to hex string
  const opacityToHex = (opacity: number) => {
    return Math.round(opacity * 255).toString(16).padStart(2, '0');
  };

  // Get vibe-based color tint with opacity - progressive based on reflection depth
  const getVibeColorTint = (baseOpacity: number = 0.05) => {
    if (isFuture) return 'transparent';

    // Increase opacity for reflected weaves based on depth
    const reflectionBoost = deepeningMetrics.level !== 'none' ? deepeningMetrics.intensity * 0.08 : 0;
    const finalOpacity = baseOpacity + reflectionBoost;

    switch (interaction.vibe) {
      case 'FullMoon':
        return colors.living.healthy[0] + opacityToHex(finalOpacity); // Teal tint
      case 'WaxingGibbous':
      case 'FirstQuarter':
        return colors.living.stable[0] + opacityToHex(finalOpacity); // Amber/Violet tint
      case 'WaxingCrescent':
      case 'NewMoon':
        return colors.secondary + opacityToHex(finalOpacity); // Neutral purple tint
      default:
        return colors.secondary + opacityToHex(finalOpacity); // Default subtle tint
    }
  };

  const cardTintColor = useMemo(() => getVibeColorTint(0.05), [isFuture, interaction.vibe, colors, deepeningMetrics]);

  // Get friendly label and icon for category (memoized)
  const { displayLabel, displayIcon } = useMemo(() => {
    const isCategory = interaction.activity && interaction.activity.includes('-');

    if (isCategory) {
      const categoryData = getCategoryMetadata(interaction.activity as InteractionCategory);
      if (categoryData) {
        return { displayLabel: categoryData.label, displayIcon: categoryData.icon };
      }
    }

    // Old format - use mode icon and activity name
    // BUT: If this is a deepened quick log, try to extract category from reflection
    const hasReflection = interaction.reflection && (interaction.reflection.chips?.length || interaction.reflection.customNotes);
    const categoryFromReflection = hasReflection && interaction.interactionCategory;

    if (categoryFromReflection) {
      const categoryData = getCategoryMetadata(categoryFromReflection as InteractionCategory);
      if (categoryData) {
        return { displayLabel: categoryData.label, displayIcon: categoryData.icon };
      }
    }

    return {
      displayLabel: interaction.activity || 'Interaction', // Fallback label
      displayIcon: modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default
    };
  }, [interaction.activity, interaction.mode, interaction.interactionCategory, interaction.reflection]);

  // Memoize dynamic styles
  const dynamicStyles = useMemo(() => ({
    sectionLabel: {
      color: colors['muted-foreground'],
    },
    dateText: {
      color: colors.foreground,
    },
    timeText: {
      color: colors['muted-foreground'],
    },
    knotOnThread: {
      backgroundColor: colors.card,
      shadowColor: warmth > 0.5 ? (isDarkMode ? colors.accent : '#D4AF37') : '#000',
    },
    card: {
      borderColor: colors.border,
    },
    cardCompleted: {
      backgroundColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    },
    cardPlanned: {
      backgroundColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.65)',
      borderColor: isDarkMode ? colors.accent + '80' : 'rgba(181, 138, 108, 0.4)',
    },
    cardTitle: {
      color: colors.foreground,
    },
    cardSubtitle: {
      color: colors['muted-foreground'],
    },
  }), [colors, warmth, isDarkMode]);

  // Animation values
  const pulseAnimation = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const cardShadow = useSharedValue(2);
  const reflectionGlow = useSharedValue(0);
  const justLoggedGlow = useSharedValue(0);

  // Line drawing animation - pen stroke effect
  const strokeDashoffset = useSharedValue(72); // Start hidden (offset = line length)

  // Knot appearance animation
  const knotScale = useSharedValue(0);
  const knotOpacity = useSharedValue(0);

  // Pause pulse animation when app is sleeping (battery optimization)
  const { isSleeping } = usePausableAnimation(pulseAnimation);

  // Entrance animation values
  const entranceOpacity = useSharedValue(0);
  const entranceScale = useSharedValue(0.92);
  const entranceTranslateY = useSharedValue(20);

  // Sequential flowing animation - cascades from top to bottom
  // Each item: knot appears → card fades → line draws to next item → next item's knot appears
  // Performance optimization: Only animate first 20 items, instant appearance for older items
  useEffect(() => {
    const ANIMATION_THRESHOLD = 20; // Only animate first 20 items

    // Skip animations for items beyond threshold - instant appearance
    if (index >= ANIMATION_THRESHOLD) {
      // Instant appearance - no delays or animations
      knotScale.value = 1;
      knotOpacity.value = 1;
      entranceOpacity.value = 1;
      entranceScale.value = 1;
      entranceTranslateY.value = 0;
      strokeDashoffset.value = 0;
      return;
    }

    const baseDelay = 150; // Initial delay before first item
    const itemDuration = 350; // Time between each item's knot appearance
    const lineDuration = 250; // Line drawing duration
    const cardDelay = 80; // Delay between knot and card

    // Calculate line target height with airgaps
    // Distance to next knot minus both gaps (bottom of current + top of next)
    const lineTargetHeight = 72; // ~90px item spacing - KNOT_SIZE - (2 * LINE_GAP)

    // Each item's knot appears at a regular interval
    const knotAppearDelay = baseDelay + (index * itemDuration);
    const cardStartDelay = knotAppearDelay + cardDelay;

    // Line draws down after knot appears (with small delay so card can start fading in)
    // Line should finish just as next item's knot is ready to appear
    const lineStartDelay = knotAppearDelay + (itemDuration - lineDuration);

    // Knot pop-in - subtle spring bounce
    knotScale.value = withDelay(
      knotAppearDelay,
      withSpring(1, {
        damping: 18,
        stiffness: 280,
        mass: 0.5,
      })
    );
    knotOpacity.value = withDelay(
      knotAppearDelay,
      withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      })
    );

    // Card animations - fade and slide up shortly after knot
    entranceOpacity.value = withDelay(
      cardStartDelay,
      withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      })
    );

    entranceScale.value = withDelay(
      cardStartDelay,
      withSpring(1, {
        damping: 20,
        stiffness: 200,
      })
    );

    entranceTranslateY.value = withDelay(
      cardStartDelay,
      withSpring(0, {
        damping: 20,
        stiffness: 220,
      })
    );

    // Line drawing animation - pen stroke effect
    // Animate strokeDashoffset from LINE_LENGTH to 0 for smooth reveal
    if (!isLastItem) {
      strokeDashoffset.value = withDelay(
        lineStartDelay,
        withTiming(0, {
          duration: lineDuration,
          easing: Easing.out(Easing.cubic), // Slight ease for natural pen stroke feel
        })
      );
    }
  }, [index, isLastItem]);

  // Subtle pulse animation for warm weaves
  useEffect(() => {
    // Only run animation when app is not sleeping
    if (warmth > 0.7 && !isFuture && !isSleeping) {
      pulseAnimation.value = withRepeat(
        withTiming(1, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease)
        }),
        -1,
        true
      );
    }
  }, [warmth, isFuture, isSleeping]);

  // Subtle glow animation for deep/profound reflections
  useEffect(() => {
    // Only animate deep and profound reflections when app is not sleeping
    if ((deepeningMetrics.level === 'deep' || deepeningMetrics.level === 'profound') && !isFuture && !isSleeping) {
      reflectionGlow.value = withRepeat(
        withTiming(1, {
          duration: 4000, // Slower, more subtle than warmth pulse
          easing: Easing.inOut(Easing.ease)
        }),
        -1,
        true
      );
    }
  }, [deepeningMetrics.level, isFuture, isSleeping]);

  // "Just Logged" celebration glow effect
  useEffect(() => {
    if (justLoggedInteractionId === interaction.id) {
      justLoggedGlow.value = withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1000, easing: Easing.in(Easing.quad) })
      );
      // Clear the ID after animation starts
      setTimeout(() => setJustLoggedInteractionId(null), 100);
    }
  }, [justLoggedInteractionId, interaction.id]);

  // Knot entrance and pulse style
  const knotAnimatedStyle = useAnimatedStyle(() => {
    // Base entrance animation
    const baseScale = knotScale.value;
    const baseOpacity = knotOpacity.value;

    // Pulse animation for warm weaves (subtle)
    if (warmth > 0.7 && !isFuture) {
      const pulseScale = interpolate(
        pulseAnimation.value,
        [0, 0.5, 1],
        [1, 1.05, 1]
      );

      const glowOpacity = interpolate(
        pulseAnimation.value,
        [0, 0.5, 1],
        [0.2, 0.4, 0.2]
      );

      return {
        transform: [{ scale: baseScale * pulseScale }],
        opacity: baseOpacity,
        shadowOpacity: warmth * glowOpacity,
      };
    }

    return {
      transform: [{ scale: baseScale }],
      opacity: baseOpacity,
    };
  });

  // Card press animation
  const handlePressIn = () => {
    pressScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    cardShadow.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    cardShadow.value = withSpring(2, { damping: 15, stiffness: 300 });
  };

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    shadowOpacity: interpolate(cardShadow.value, [1, 2], [0.05, 0.08]),
    shadowRadius: interpolate(cardShadow.value, [1, 2], [4, 8]),
    opacity: isFuture ? 0.6 : 1, // Reduced opacity for future plans
  }));

  // Reflection glow overlay style - subtle pulse for deep reflections
  const reflectionGlowStyle = useAnimatedStyle(() => {
    if (deepeningMetrics.level === 'none' || isFuture) return { opacity: 0 };

    // Base glow intensity increases with reflection depth
    const baseGlow = deepeningMetrics.intensity * 0.15;

    // Only pulse for deep/profound
    const shouldPulse = deepeningMetrics.level === 'deep' || deepeningMetrics.level === 'profound';
    const pulseGlow = shouldPulse
      ? interpolate(reflectionGlow.value, [0, 1], [baseGlow, baseGlow * 1.3])
      : baseGlow;

    return {
      opacity: pulseGlow,
    };
  });

  // Just-logged glow style - bright celebration flash
  const justLoggedGlowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(justLoggedGlow.value, [0, 0.5, 1], [0, 0.7, 0]);
    const scale = interpolate(justLoggedGlow.value, [0, 1], [1, 1.05]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });


  // Icon subtle rotation for organic feel
  const iconRotation = Math.random() * 4 - 2; // -2° to +2°

  // Animated SVG line props - properly connect SharedValue to SVG
  const animatedLineProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: strokeDashoffset.value,
    };
  });

  // Container entrance animation - combines all entrance effects
  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: entranceOpacity.value,
      transform: [
        { translateY: entranceTranslateY.value },
        { scale: entranceScale.value },
      ],
    };
  });

  // Scroll-based fade for items near viewport edges (optional subtle effect)
  const scrollFadeStyle = useAnimatedStyle(() => {
    if (!scrollY || itemY === 0) return { opacity: 1 };
    
    const itemPosition = itemY - scrollY.value;
    
    // Very subtle fade at edges (only affects extreme positions)
    const topFade = interpolate(
      itemPosition,
      [-50, 50],
      [0.6, 1],
      'clamp'
    );
    
    const bottomFade = interpolate(
      itemPosition,
      [600, 750],
      [1, 0.6],
      'clamp'
    );
    
    return {
      opacity: Math.min(topFade, bottomFade),
    };
  });

  // ContinuousThread container is at left: 98px (absolute)
  // But threadCore inside it is at left: 0, so thread is at 98px from screen
  // itemWrapper has paddingHorizontal: 20px
  // knotAbsoluteContainer has left: 20px to offset the padding
  // So knot position should be: 98px (thread) - 20px (wrapper padding) - 20px (container offset) = 58px
  const THREAD_CENTER = 58;
  const KNOT_SIZE = 10; // Smaller knots - more like "O" rings
  const KNOT_BORDER_WIDTH = 2; // Thicker border for hollow appearance
  const LINE_GAP = 4; // Gap between line and knot (top and bottom)
  const LINE_LENGTH = 72; // Total line length for SVG path animation
  const CARD_START = 72 + 16 + 20; // dateColumn + gap + knotContainer

  // Get section accent color
  const getSectionAccentColor = (label?: string) => {
    if (!label) return 'transparent';
    if (label.includes('Seeds')) return isDarkMode ? colors.accent + '60' : 'rgba(181, 138, 108, 0.4)';
    if (label.includes('Today')) return isDarkMode ? colors.primary + '90' : 'rgba(212, 175, 55, 0.8)';
    return isDarkMode ? colors.secondary + '70' : 'rgba(181, 138, 108, 0.6)';
  };

  return (
    <View>
      {/* Section label chip - only for first item in section */}
      {isFirstInSection && sectionLabel && (
        <View className="flex-row items-center pl-[98px] pb-2 gap-1.5">
          <View className="w-0.5 h-3 rounded-[1px] opacity-60" style={{ backgroundColor: getSectionAccentColor(sectionLabel) }} />
          <Text className="text-[10px] font-semibold uppercase tracking-widest" style={dynamicStyles.sectionLabel}>{sectionLabel}</Text>
        </View>
      )}

      <Animated.View className="flex-row items-center gap-4 pb-6" style={[containerAnimatedStyle, scrollFadeStyle]}>
        {/* Knot positioned absolutely on the thread with connector line */}
      <View className="absolute w-full h-10 top-2 left-5 z-10" pointerEvents="none">
        {/* Connector line from thread to card */}
        {/* Future: dotted, Past: solid */}
        <View
          className="absolute h-[1.5px] top-5"
          style={{
            left: THREAD_CENTER,
            width: CARD_START - THREAD_CENTER,
            backgroundColor: isDarkMode ? colors.border : 'rgba(181, 138, 108, 0.5)',
            opacity: isFuture ? 0.5 : 1,
            borderStyle: isFuture ? 'dotted' : 'solid',
          }}
        />

        {/* Knot on thread - centered on thread */}
        {/* Knots fade from golden (recent) to white (distant) - hollow "O" appearance */}
        <Animated.View
          className="absolute w-[10px] h-[10px] top-4 rounded-full border-2 shadow-sm"
          style={[
            knotAnimatedStyle,
            {
              left: THREAD_CENTER - (KNOT_SIZE / 2),
              backgroundColor: isFuture ? 'transparent' : (temporalColors.knot === colors.card ? 'transparent' : temporalColors.knot),
              borderColor: isFuture ? 'rgba(247, 245, 242, 0.6)' : temporalColors.line,
              shadowColor: temporalColors.glow,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: warmth > 0.5 ? 0.3 : 0.15,
              shadowRadius: 3 + (warmth * 6),
            }
          ]}
        >
          {/* Glow effect for warm/recent knots */}
          {warmth > 0.5 && !isFuture && (
            <View
              className="absolute w-4 h-4 -top-[3px] -left-[3px] rounded-full -z-10 opacity-20"
              style={{
                backgroundColor: temporalColors.glow,
              }}
            />
          )}
        </Animated.View>

        {/* Vertical line segment connecting to next item (point-to-point) */}
        {/* Line has airgaps at both ends - doesn't touch knots */}
        {/* SVG line with pen stroke animation - draws on smoothly from top to bottom */}
        {!isLastItem && (
          <Svg
            style={{
              position: 'absolute',
              left: THREAD_CENTER - 0.5,
              top: 16 + KNOT_SIZE + LINE_GAP,
              width: 2,
              height: 72,
            }}
            pointerEvents="none"
          >
            <AnimatedLine
              x1="1"
              y1="0"
              x2="1"
              y2="72"
              stroke={temporalColors.line}
              strokeWidth="1"
              strokeDasharray="4 4"
              strokeOpacity={lineOpacity}
              strokeLinecap="round"
              animatedProps={animatedLineProps}
            />
          </Svg>
        )}
      </View>

      {/* Date Column */}
      <View className="w-[72px] items-end pt-2 pr-2 shrink-0">
        <Text className="text-xs font-semibold mb-0.5" style={dynamicStyles.dateText} numberOfLines={1}>{primary}</Text>
        <Text className="text-[11px] font-normal" style={dynamicStyles.timeText} numberOfLines={1}>{secondary}</Text>
      </View>

      {/* Empty spacer where knot used to be */}
      <View className="w-5" />

      {/* Card */}
      <TouchableOpacity
        className="flex-1"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          className="rounded-2xl overflow-hidden shadow-sm elevation-4 border"
          style={[
            dynamicStyles.card,
            isFuture ? dynamicStyles.cardPlanned : dynamicStyles.cardCompleted,
            cardAnimatedStyle,
            {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
            },
            // Scale-based border and shadow for deepened weaves
            deepeningMetrics.level !== 'none' && {
              borderColor: colors.primary + deepeningVisuals.borderOpacity.toString(16).padStart(2, '0'),
              borderWidth: deepeningVisuals.borderWidth,
              shadowColor: colors.primary,
              shadowOpacity: deepeningVisuals.shadowOpacity,
              shadowRadius: deepeningVisuals.shadowRadius,
              shadowOffset: { width: 0, height: 2 },
            },
          ]}
        >
          {/* Simple solid background with color tint overlay */}
          <View className="absolute inset-0" style={{ backgroundColor: isDarkMode ? colors.card : colors.card }} />
          <View className="absolute inset-0" style={{ backgroundColor: cardTintColor }} />

          {/* Reflection glow overlay for deepened weaves */}
          {deepeningMetrics.level !== 'none' && !isFuture && (
            <Animated.View
              className="absolute inset-0"
              style={[
                reflectionGlowStyle,
                { backgroundColor: colors.primary }
              ]}
              pointerEvents="none"
            />
          )}

          {/* Just-logged celebration glow */}
          <Animated.View
            className="absolute inset-0 z-20"
            style={[
              justLoggedGlowStyle,
              { backgroundColor: 'white' }
            ]}
            pointerEvents="none"
          />

          <View className="p-4 flex-row items-start gap-3 z-[1]">
            {/* Icon with deepened indicator */}
            <View>
              <Text
                className="text-[26px] opacity-90"
                style={{ transform: [{ rotate: `${iconRotation}deg` }] }}
              >
                {displayIcon}
              </Text>
              {/* Deepened weave indicator - scale-based sparkles */}
              {deepeningMetrics.level !== 'none' && (
                <View className="absolute -top-1 -right-1">
                  <Text className="text-sm">{deepeningVisuals.badgeEmoji}</Text>
                </View>
              )}
            </View>
            <View className="flex-1">
              {/* Show custom title if it exists, otherwise show category label */}
              <Text className="font-semibold mb-1 text-base font-[Lora_700Bold]" style={dynamicStyles.cardTitle}>
                {interaction.title || displayLabel}
              </Text>
              {/* Show category as subtitle if custom title exists, otherwise show mode */}
              <Text className="text-[13px] capitalize" style={dynamicStyles.cardSubtitle}>
                {interaction.title ? displayLabel : interaction.mode?.replace('-', ' ')}
              </Text>
              {/* Reflection chip preview - scale-based label */}
              {deepeningMetrics.level !== 'none' && (
                <View className="mt-1.5">
                  <Text className="text-[11px] font-medium opacity-70" style={{ color: colors.primary }} numberOfLines={1}>
                    {deepeningVisuals.badgeText}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if interaction data actually changes
  return (
    prevProps.interaction.id === nextProps.interaction.id &&
    prevProps.interaction.updatedAt === nextProps.interaction.updatedAt &&
    prevProps.isFuture === nextProps.isFuture &&
    prevProps.index === nextProps.index &&
    prevProps.isLastItem === nextProps.isLastItem
  );
});

// NativeWind classes used throughout TimelineItem:
// Section Chip: flex-row items-center pl-[98px] pb-2 pt-3 gap-1.5
// Section Accent: w-0.5 h-3 rounded-[1px] opacity-60
// Section Label: text-[10px] font-semibold uppercase tracking-widest
// Swipe Container: relative
// Edit/Delete Backgrounds: absolute with specific positioning, gap-2
// Item Container: flex-row items-center gap-4 pb-6
// Knot Container: absolute w-full h-10 top-2 left-5 z-10
// Connector Line: absolute h-[1.5px] top-5
// Knot: absolute w-2 h-2 top-4 rounded-full border-[1.5px] shadow-sm elevation-3
// Knot Glow: absolute w-4 h-4 rounded-full -top-1 -left-1 -z-10
// Date Column: w-[72px] items-end pt-2 pr-2 shrink-0
// Date Text: text-xs font-semibold mb-0.5
// Time Text: text-[11px] font-normal
// Knot Spacer: w-5
// Card Container: flex-1
// Card: rounded-2xl overflow-hidden shadow-sm elevation-4 border
// Card Backgrounds: absolute inset-0
// Card Content: p-4 flex-row items-start gap-3 z-[1]
// Icon: text-[26px] opacity-90
// Deepened Indicator: absolute -top-1 -right-1
// Title: font-semibold mb-1 text-base font-[Lora_700Bold]
// Subtitle: text-[13px] capitalize
// Reflection Preview: mt-1.5, text-[11px] font-medium opacity-70