import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Trash2, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../hooks/useTheme';
import { formatPoeticDate, calculateWeaveWarmth, getThreadColors } from '../lib/timeline-utils';
import { modeIcons } from '../lib/constants';
import { getCategoryMetadata } from '../lib/interaction-categories';
import { type Interaction, type InteractionCategory } from './types';
import { calculateDeepeningLevel, getDeepeningVisuals } from '../lib/deepening-utils';
import { usePausableAnimation } from '../hooks/usePausableAnimation';
import { useUIStore } from '../stores/uiStore';

interface TimelineItemProps {
  interaction: Interaction;
  isFuture: boolean;
  onPress: () => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
  index: number;
  scrollY?: Animated.SharedValue<number>;
  itemY?: number;
  showKnot?: boolean;
  sectionLabel?: string;
  isFirstInSection?: boolean;
}

export const TimelineItem = React.memo(({ interaction, isFuture, onPress, onDelete, onEdit, index, scrollY, itemY = 0, showKnot = true, sectionLabel, isFirstInSection = false }: TimelineItemProps) => {
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

  // Pause pulse animation when app is sleeping (battery optimization)
  const { isSleeping } = usePausableAnimation(pulseAnimation);

  // Entrance animation values
  const entranceOpacity = useSharedValue(0);
  const entranceScale = useSharedValue(0.92);
  const entranceTranslateY = useSharedValue(20);

  // Beautiful staggered entrance - scale + fade + slide
  useEffect(() => {
    const baseDelay = 200; // Let thread draw in first
    const stagger = index * 100; // Stagger each item
    const delay = baseDelay + stagger;

    // Opacity: Quick fade in
    entranceOpacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: 400, // Faster fade
        easing: Easing.out(Easing.quad),
      })
    );

    // Scale: Subtle zoom in
    entranceScale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 20,
        stiffness: 150, // Snappier spring
      })
    );

    // TranslateY: Gentle upward float
    entranceTranslateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 20,
        stiffness: 180, // Snappier spring
      })
    );
  }, [index]);

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

  // Knot pulse style - very subtle
  const knotAnimatedStyle = useAnimatedStyle(() => {
    if (warmth <= 0.7 || isFuture) {
      return {};
    }

    const scale = interpolate(
      pulseAnimation.value,
      [0, 0.5, 1],
      [1, 1.05, 1] // Much more subtle scale
    );

    const glowOpacity = interpolate(
      pulseAnimation.value,
      [0, 0.5, 1],
      [0.2, 0.4, 0.2]
    );

    return {
      transform: [{ scale }],
      shadowOpacity: warmth * glowOpacity,
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

  // Swipe to edit/delete
  const translateX = useSharedValue(0);
  const itemOpacity = useSharedValue(1);
  const SWIPE_THRESHOLD = 80; // Swipe 80px to trigger action (left or right)

  // Create non-async wrappers for handlers
  const handleDelete = React.useCallback(() => {
    if (onDelete) {
      onDelete(interaction.id);
    }
  }, [onDelete, interaction.id]);

  const handleEdit = React.useCallback(() => {
    if (onEdit) {
      onEdit(interaction.id);
    }
  }, [onEdit, interaction.id]);

  const hasTriggeredHaptic = useSharedValue(false);

  const triggerHaptic = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(!!(onDelete || onEdit)) // Enable if either handler exists
    .activeOffsetX([-15, 15]) // Activate for either direction
    .failOffsetY([-20, 20]) // Fail if vertical movement exceeds 20px
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;

      // Trigger haptic when crossing threshold
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerHaptic)();
      }
      // Reset haptic trigger when going back below threshold
      if (Math.abs(event.translationX) < SWIPE_THRESHOLD) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd((event) => {
      'worklet';
      // Swipe right to edit
      if (event.translationX > SWIPE_THRESHOLD && onEdit) {
        // Snap back and trigger edit
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        runOnJS(handleEdit)();
      }
      // Swipe left to delete
      else if (event.translationX < -SWIPE_THRESHOLD && onDelete) {
        // Fade out animation, then delete
        itemOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(handleDelete)();
          }
        });
        translateX.value = withTiming(-400, { duration: 200 });
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
      hasTriggeredHaptic.value = false;
    });

  const swipeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: itemOpacity.value,
  }));

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
  const KNOT_SIZE = 8; // Smaller, more subtle knots
  const CARD_START = 72 + 16 + 20; // dateColumn + gap + knotContainer

  // Get section accent color
  const getSectionAccentColor = (label?: string) => {
    if (!label) return 'transparent';
    if (label.includes('Seeds')) return isDarkMode ? colors.accent + '60' : 'rgba(181, 138, 108, 0.4)';
    if (label.includes('Today')) return isDarkMode ? colors.primary + '90' : 'rgba(212, 175, 55, 0.8)';
    return isDarkMode ? colors.secondary + '70' : 'rgba(181, 138, 108, 0.6)';
  };

  // Action backgrounds visibility
  const editBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));

  const deleteBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));

  return (
    <View>
      {/* Section label chip - only for first item in section */}
      {isFirstInSection && sectionLabel && (
        <View className="flex-row items-center pl-[98px] pb-2 pt-3 gap-1.5">
          <View className="w-0.5 h-3 rounded-[1px] opacity-60" style={{ backgroundColor: getSectionAccentColor(sectionLabel) }} />
          <Text className="text-[10px] font-semibold uppercase tracking-widest" style={dynamicStyles.sectionLabel}>{sectionLabel}</Text>
        </View>
      )}

      <View className="relative">
        {/* Edit background (left side - swipe right to reveal) */}
        {onEdit && (
          <Animated.View className="absolute left-5 top-0 bottom-6 justify-center items-start gap-2 pl-[100px] z-[1]" style={editBackgroundStyle}>
            <Edit3 color={colors.primary} size={24} />
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Edit</Text>
          </Animated.View>
        )}

        {/* Delete background (right side - swipe left to reveal) */}
        {onDelete && (
          <Animated.View className="absolute right-5 top-0 bottom-6 justify-center items-end gap-2 pr-10 z-[1]" style={deleteBackgroundStyle}>
            <Trash2 color={colors.destructive} size={24} />
            <Text className="text-sm font-semibold" style={{ color: colors.destructive }}>Delete</Text>
          </Animated.View>
        )}

        {/* Swipeable content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View className="flex-row items-center gap-4 pb-6" style={[containerAnimatedStyle, scrollFadeStyle, swipeAnimatedStyle]}>
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
        {/* Future knots are hollow (transparent), past knots are filled */}
        <Animated.View
          className="absolute w-2 h-2 top-4 rounded-full border-[1.5px] border-[rgba(247,245,242,0.9)] shadow-sm elevation-3"
          style={[
            knotAnimatedStyle,
            {
              left: THREAD_CENTER - (KNOT_SIZE / 2),
              backgroundColor: isFuture ? 'transparent' : colors.card,
              shadowColor: warmth > 0.5 ? (isDarkMode ? colors.accent : '#D4AF37') : (isDarkMode ? '#000' : '#000'),
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 4 + (warmth * 8),
            }
          ]}
        >
          {/* Glow effect for warm knots */}
          {warmth > 0.5 && !isFuture && (
            <View
              className="absolute w-4 h-4 rounded-full -top-1 -left-1 -z-10"
              style={{ backgroundColor: isDarkMode ? colors.accent : colors.glow }}
            />
          )}
        </Animated.View>
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
        </GestureDetector>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if interaction data actually changes
  return (
    prevProps.interaction.id === nextProps.interaction.id &&
    prevProps.interaction.updatedAt === nextProps.interaction.updatedAt &&
    prevProps.isFuture === nextProps.isFuture &&
    prevProps.index === nextProps.index
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