import React, { useEffect } from 'react';
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
  const { colors } = useTheme();
  const { setArchetypeModal, justNurturedFriendId, setJustNurturedFriendId } = useUIStore();
  const { activeCardId } = useCardGesture();

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
    <Animated.View ref={animatedRef} style={[styles.shadowContainer, cardStyle]}>
      <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Animated.View style={[styles.gradientLayer, attentionGradientStyle]}>
          <LinearGradient colors={colors.living.attention} style={StyleSheet.absoluteFill} animatedProps={pulseAnimationStyle} />
        </Animated.View>
        <Animated.View style={[styles.gradientLayer, stableGradientStyle]}>
          <LinearGradient colors={colors.living.stable} style={StyleSheet.absoluteFill} animatedProps={pulseAnimationStyle} />
        </Animated.View>
        <Animated.View style={[styles.gradientLayer, healthyGradientStyle]}>
          <LinearGradient colors={colors.living.healthy} style={StyleSheet.absoluteFill} animatedProps={pulseAnimationStyle} />
        </Animated.View>
        <Animated.View style={[styles.glow, glowStyle]} />
        <View style={styles.innerContent}>
          <View style={styles.header}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{(name || '?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.name}>{name || '...'}</Text>
              <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
                {archetypeData[archetype]?.essence}
              </Text>
            </View>
            <View onLongPress={handleArchetypeLongPress} style={styles.archetypeButton}>
              <ArchetypeIcon archetype={archetype} size={20} color={colors['muted-foreground']} />
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8
  },
  cardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  gradientLayer: {
    ...StyleSheet.absoluteFillObject
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 10
  },
  innerContent: {
    margin: 2,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    zIndex: 20
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 2,
    backgroundColor: 'rgba(200, 200, 200, 0.3)'
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
  avatarInitial: {
    fontWeight: '600',
    fontSize: 20,
    color: '#3C3C3C',
  },
  headerTextContainer: {
    flex: 1
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
    marginBottom: 4,
    color: '#3C3C3C',
  },
  statusText: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  archetypeButton: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    borderRadius: 12 
  },
});
