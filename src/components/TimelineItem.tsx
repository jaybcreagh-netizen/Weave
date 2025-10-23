import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useTheme } from '../hooks/useTheme';
import { formatPoeticDate, calculateWeaveWarmth, getThreadColors } from '../lib/timeline-utils';
import { modeIcons } from '../lib/constants';
import { getCategoryMetadata } from '../lib/interaction-categories';
import { type Interaction, type InteractionCategory } from './types';

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
}

export function TimelineItem({ interaction, isFuture, onPress, index, scrollY, itemY = 0, showKnot = true, sectionLabel, isFirstInSection = false }: TimelineItemProps) {
  const { colors, isDarkMode } = useTheme();
  const date = typeof interaction.interactionDate === 'string' 
    ? new Date(interaction.interactionDate) 
    : interaction.interactionDate;
  
  const warmth = calculateWeaveWarmth(date);
  const threadColors = getThreadColors(warmth, isFuture);
  const { primary, secondary } = formatPoeticDate(date);

  const cardTintColor = useMemo(() => {
    if (!isDarkMode || isFuture) return 'transparent';

    switch (interaction.vibe) {
      case 'FullMoon':
        return colors.living.healthy[0] + '40'; // Teal tint
      case 'WaxingGibbous':
      case 'FirstQuarter':
        return colors.living.stable[0] + '40'; // Violet tint
      case 'WaxingCrescent':
      case 'NewMoon':
        return colors.secondary + '60'; // Neutral purple tint
      default:
        return colors.secondary + '40'; // Default subtle tint
    }
  }, [isDarkMode, isFuture, interaction.vibe, colors]);

  // Get friendly label and icon for category (or fall back to activity)
  const isCategory = interaction.activity && interaction.activity.includes('-');

  let displayLabel: string;
  let displayIcon: string;

  if (isCategory) {
    const categoryData = getCategoryMetadata(interaction.activity as InteractionCategory);
    displayLabel = categoryData.label;
    displayIcon = categoryData.icon;
  } else {
    // Old format - use mode icon and activity name
    displayLabel = interaction.activity;
    displayIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;
  }

  // Define dynamic styles inside the component
  const dynamicStyles = {
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
  };

  // Animation values
  const pulseAnimation = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const cardShadow = useSharedValue(2);

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
    if (warmth > 0.7 && !isFuture) {
      pulseAnimation.value = withRepeat(
        withTiming(1, {
          duration: 3000,
          easing: Easing.inOut(Easing.ease)
        }),
        -1,
        true
      );
    }
  }, [warmth, isFuture]);

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

  // Warm glow overlay for cards
  const cardGlowStyle = useAnimatedStyle(() => {
    if (isFuture) return { opacity: 0 };
    
    const glowIntensity = warmth * 0.25;
    const pulseGlow = interpolate(
      pulseAnimation.value,
      [0, 1],
      [glowIntensity, glowIntensity * 1.2]
    );
    
    return {
      opacity: warmth > 0.5 ? pulseGlow : glowIntensity,
    };
  });

  // Icon subtle rotation for organic feel
  const iconRotation = Math.random() * 4 - 2; // -2° to +2°

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

  return (
    <View>
      {/* Section label chip - only for first item in section */}
      {isFirstInSection && sectionLabel && (
        <View style={styles.sectionChipContainer}>
          <View style={[styles.sectionAccent, { backgroundColor: getSectionAccentColor(sectionLabel) }]} />
          <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>{sectionLabel}</Text>
        </View>
      )}

      <Animated.View style={[styles.itemContainer, containerAnimatedStyle, scrollFadeStyle]}>
        {/* Knot positioned absolutely on the thread with connector line */}
      <View style={styles.knotAbsoluteContainer} pointerEvents="none">
        {/* Connector line from thread to card */}
        <View style={[
          styles.connectorLine,
          {
            left: THREAD_CENTER,
            width: CARD_START - THREAD_CENTER,
            backgroundColor: isDarkMode ? colors.border : 'rgba(181, 138, 108, 0.5)',
          }
        ]} />

        {/* Knot on thread - centered on thread */}
        <Animated.View style={[
          styles.knotOnThread,
          knotAnimatedStyle,
          {
            left: THREAD_CENTER - (KNOT_SIZE / 2),
            backgroundColor: colors.card,
            shadowColor: warmth > 0.5 ? (isDarkMode ? colors.accent : '#D4AF37') : (isDarkMode ? '#000' : '#000'),
            shadowRadius: 4 + (warmth * 8),
          }
        ]}>
          {/* Glow effect for warm knots */}
          {warmth > 0.5 && !isFuture && (
            <View
              style={[
                styles.knotGlow,
                { backgroundColor: isDarkMode ? colors.accent : colors.glow }
              ]}
            />
          )}
        </Animated.View>
      </View>

      {/* Date Column */}
      <View style={styles.dateColumn}>
        <Text style={[styles.dateText, dynamicStyles.dateText]} numberOfLines={1}>{primary}</Text>
        <Text style={[styles.timeText, dynamicStyles.timeText]} numberOfLines={1}>{secondary}</Text>
      </View>

      {/* Empty spacer where knot used to be */}
      <View style={styles.knotContainer} />

      {/* Card */}
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View style={[
          styles.card,
          dynamicStyles.card,
          isFuture ? dynamicStyles.cardPlanned : dynamicStyles.cardCompleted,
          cardAnimatedStyle,
        ]}>
          <BlurView 
            intensity={isDarkMode ? 40 : 100} 
            tint={isDarkMode ? 'dark' : 'light'} 
            style={[StyleSheet.absoluteFill, { backgroundColor: cardTintColor }]} 
          />
          {/* Warm glow gradient overlay */}
          {!isFuture && warmth > 0 && (
            <Animated.View 
              style={[StyleSheet.absoluteFill, cardGlowStyle]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  isDarkMode ? colors.primary + '1A' : 'rgba(255, 248, 230, 1)',
                  isDarkMode ? colors.primary + '0A' : 'rgba(255, 248, 230, 0.5)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          <View style={styles.cardContent}>
            <Text style={[
              styles.cardIcon,
              { transform: [{ rotate: `${iconRotation}deg` }] }
            ]}>
              {displayIcon}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, dynamicStyles.cardTitle]}>{displayLabel}</Text>
              <Text style={[styles.cardSubtitle, dynamicStyles.cardSubtitle]}>
                {interaction.mode?.replace('-', ' ')}
              </Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 98, // Align with thread
    paddingBottom: 12,
    paddingTop: 16,
    gap: 8,
  },
  sectionAccent: {
    width: 2,
    height: 12,
    borderRadius: 1,
    opacity: 0.6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 24,
  },
  dateColumn: {
    width: 72,
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingRight: 8,
    flexShrink: 0,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeText: { 
    fontSize: 11, 
    fontWeight: '400',
  },
  knotContainer: {
    width: 20, // Fixed width spacer for knot column
  },
  knotAbsoluteContainer: {
    position: 'absolute',
    width: '100%',
    height: 40,
    top: 8,
    left: 20, // Account for item wrapper padding
    zIndex: 10,
  },
  connectorLine: {
    position: 'absolute',
    height: 1.5,
    top: 20,
  },
  knotOnThread: {
    position: 'absolute',
    width: 8,
    height: 8,
    top: 16, // Adjusted for smaller size
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(247, 245, 242, 0.9)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  knotGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -4,
    left: -4,
    zIndex: -1,
  },
  cardContainer: { 
    flex: 1 
  },
  card: { 
    borderRadius: 16, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 1,
  },
  cardContent: {
    padding: 16,
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12,
    zIndex: 1,
  },
  cardIcon: { 
    fontSize: 26,
    opacity: 0.9,
  },
  cardTitle: { 
    fontWeight: '600', 
    marginBottom: 4, 
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
  },
  cardSubtitle: { 
    fontSize: 13, 
    textTransform: 'capitalize',
  },
});