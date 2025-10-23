import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useUIStore } from '../stores/uiStore';
import { type Archetype } from './types';
import { useTheme } from '../hooks/useTheme';
import { ArchetypeIcon } from './ArchetypeIcon';
import { archetypeData } from '../lib/constants';
import FriendModel from '../db/models/Friend';
import { useCardGesture } from '../context/CardGestureContext';

const ATTENTION_THRESHOLD = 35;
const STABLE_THRESHOLD = 65;

interface FriendCardProps {
  friend: FriendModel;
  animatedRef: React.RefObject<Animated.View>;
}

export function FriendCard({ friend, animatedRef }: FriendCardProps) {
  if (!friend) return null;

  const { id, name, archetype, weaveScore, isDormant = false, photoUrl } = friend;
  const { colors, isDarkMode } = useTheme();
  const { setArchetypeModal, justNurturedFriendId, setJustNurturedFriendId } = useUIStore();
  const { activeCardId } = useCardGesture();

  const glowColor = useMemo(() => {
    if (!isDarkMode) return '#000'; // Black shadow for light mode
    if (weaveScore > STABLE_THRESHOLD) return colors.living.healthy[0];
    if (weaveScore > ATTENTION_THRESHOLD) return colors.living.stable[0];
    return colors.living.attention[0];
  }, [isDarkMode, weaveScore, colors]);

  // Define dynamic styles inside the component
  const dynamicStyles = {
    shadowContainer: {
      borderRadius: 36,
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.1,
      shadowRadius: isDarkMode ? 12 : 8,
      elevation: 8,
    },
    cardContainer: {
      borderRadius: 36,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDarkMode ? 'rgba(37, 33, 56, 0.85)' : colors.card,
    },
    name: {
      fontSize: 20,
      fontWeight: '600',
      fontFamily: 'Lora_700Bold',
      marginBottom: 4,
      color: colors.foreground,
    },
    statusText: {
      fontSize: 14,
      color: colors.foreground,
      opacity: 0.7,
    },
    archetypeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.0)',
    },
    avatarRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      padding: 2,
      backgroundColor: isDarkMode ? colors.secondary : 'rgba(200, 200, 200, 0.3)',
      borderWidth: 0.5,
      borderColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.0)',
    },
    avatarInitial: {
      fontWeight: '600',
      fontSize: 20,
      color: colors.foreground,
    },
  };

  const pulse = useSharedValue(0);
  const glowProgress = useSharedValue(0);

  useEffect(() => {
    const pulseDuration = interpolate(weaveScore, [0, 100], [5000, 2000]);
    pulse.value = withRepeat(withTiming(1, { duration: pulseDuration, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [weaveScore, pulse]);

  useEffect(() => {
    if (justNurturedFriendId === id) {
      glowProgress.value = withSequence(
        withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1000, easing: Easing.in(Easing.quad) })
      );
      setJustNurturedFriendId(null);
    }
  }, [justNurturedFriendId, id]);

  const handleArchetypeLongPress = () => {
    setArchetypeModal(archetype);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const healthyGradientStyle = useAnimatedStyle(() => ({ 
    opacity: interpolate(weaveScore, [STABLE_THRESHOLD - 10, STABLE_THRESHOLD], [0, 1], 'clamp') 
  }));
  const stableGradientStyle = useAnimatedStyle(() => ({ 
    opacity: interpolate(weaveScore, [ATTENTION_THRESHOLD - 10, ATTENTION_THRESHOLD, STABLE_THRESHOLD, STABLE_THRESHOLD + 10], [0, 1, 1, 0], 'clamp') 
  }));
  const attentionGradientStyle = useAnimatedStyle(() => ({ 
    opacity: interpolate(weaveScore, [ATTENTION_THRESHOLD, ATTENTION_THRESHOLD + 10], [1, 0], 'clamp') 
  }));
  const pulseAnimationStyle = useAnimatedStyle(() => {
    const startX = interpolate(pulse.value, [0, 1], [0, 0.25]);
    const startY = interpolate(pulse.value, [0, 1], [0, 0.75]);
    const endX = interpolate(pulse.value, [0, 1], [1, 0.75]);
    const endY = interpolate(pulse.value, [0, 1], [1, 0.25]);
    return { start: { x: startX, y: startY }, end: { x: endX, y: endY } };
  });
  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowProgress.value, [0, 0.5, 1], [0, 0.6, 0]);
    const scaleVal = interpolate(glowProgress.value, [0, 1], [1, 2.5]);
    return { opacity, transform: [{ scale: scaleVal }] };
  });

  const cardStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId.value === id;
    return {
      transform: [{ scale: withSpring(isGestureActive ? 1.05 : 1, { damping: 30, stiffness: 400 }) }],
      opacity: isDormant ? 0.6 : 1,
    };
  });

  return (
    <Animated.View ref={animatedRef} style={[dynamicStyles.shadowContainer, cardStyle]}>
      <View style={dynamicStyles.cardContainer}>
        {/* Living color gradients - prominent and visible */}
        <Animated.View style={[styles.gradientLayer, attentionGradientStyle]}>
          <LinearGradient
            colors={[`${colors.living.attention[0]}CC`, `${colors.living.attention[1]}99`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1.2, y: 1.2 }}
            style={StyleSheet.absoluteFill}
            animatedProps={pulseAnimationStyle}
          />
        </Animated.View>
        <Animated.View style={[styles.gradientLayer, stableGradientStyle]}>
          <LinearGradient
            colors={[`${colors.living.stable[0]}CC`, `${colors.living.stable[1]}99`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1.2, y: 1.2 }}
            style={StyleSheet.absoluteFill}
            animatedProps={pulseAnimationStyle}
          />
        </Animated.View>
        <Animated.View style={[styles.gradientLayer, healthyGradientStyle]}>
          <LinearGradient
            colors={[`${colors.living.healthy[0]}CC`, `${colors.living.healthy[1]}99`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1.2, y: 1.2 }}
            style={StyleSheet.absoluteFill}
            animatedProps={pulseAnimationStyle}
          />
        </Animated.View>
        <Animated.View style={[styles.glow, glowStyle]} />

        {/* iOS-style subtle highlight */}
        <View style={styles.topHighlight} />

        {/* Inner border for depth */}
        <View style={styles.innerBorder} />

        <View style={styles.innerContent}>
          <View style={styles.header}>
            <View style={dynamicStyles.avatarRing}>
              <View style={styles.avatar}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={dynamicStyles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={dynamicStyles.name}>{name}</Text>
              <Text style={dynamicStyles.statusText} numberOfLines={1} ellipsizeMode="tail">
                {archetypeData[archetype]?.essence}
              </Text>
            </View>
            <View onLongPress={handleArchetypeLongPress} style={dynamicStyles.archetypeButton}>
              <ArchetypeIcon archetype={archetype} size={20} color={isDarkMode ? colors.foreground : colors['muted-foreground']} />
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradientLayer: {
    ...StyleSheet.absoluteFillObject
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 10
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 15,
  },
  innerBorder: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 35,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    pointerEvents: 'none',
    zIndex: 15,
  },
  innerContent: {
    padding: 16,
    backgroundColor: 'transparent', // Changed from a fixed color
    zIndex: 20
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  avatar: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 26, 
    overflow: 'hidden', 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarImage: { 
    width: '100%', 
    height: '100%' 
  },
  headerTextContainer: {
    flex: 1
  },
});
