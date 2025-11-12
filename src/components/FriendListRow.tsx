import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';

import { useUIStore } from '../stores/uiStore';
import { type Archetype, type RelationshipType } from './types';
import { useTheme } from '../hooks/useTheme';
import { ArchetypeIcon } from './ArchetypeIcon';
import { archetypeData } from '../lib/constants';
import FriendModel from '../db/models/Friend';
import { useCardGesture } from '../context/CardGestureContext';
import { calculateCurrentScore } from '../lib/weave-engine';
import { generateIntelligentStatusLine } from '../lib/intelligent-status-line';
import { normalizeContactImageUri } from '../lib/image-utils';

const ATTENTION_THRESHOLD = 35;
const STABLE_THRESHOLD = 65;

// Relationship type icon mapping
const RELATIONSHIP_ICONS: Record<RelationshipType, string> = {
  friend: '🤝',
  family: '👨‍👩‍👧‍👦',
  partner: '❤️',
  colleague: '💼',
  neighbor: '🏘️',
  mentor: '🎓',
  creative: '🎨',
};

interface FriendListRowProps {
  friend: FriendModel;
  animatedRef?: React.RefObject<Animated.View>;
  variant?: 'default' | 'full';
}

export function FriendListRow({ friend, animatedRef, variant = 'default' }: FriendListRowProps) {
  if (!friend) return null;

  const { id, name, archetype, isDormant = false, photoUrl, relationshipType } = friend;
  const [statusLine, setStatusLine] = useState<{ text: string; icon?: string }>({
    text: archetypeData[archetype]?.essence || ''
  });
  const [imageError, setImageError] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const { setArchetypeModal, justNurturedFriendId, setJustNurturedFriendId } = useUIStore();
  const { activeCardId } = useCardGesture();

  // Calculate current score with decay
  const weaveScore = useMemo(
    () => calculateCurrentScore(friend),
    [friend, friend.lastUpdated]
  );

  // Determine gradient colors based on score
  const gradientColors = useMemo(() => {
    if (weaveScore > STABLE_THRESHOLD) {
      return colors.living.healthy;
    } else if (weaveScore > ATTENTION_THRESHOLD) {
      return colors.living.stable;
    } else {
      return colors.living.attention;
    }
  }, [weaveScore, colors]);

  // Determine gradient opacity based on score (attention gets more visible)
  const gradientOpacity = useMemo(() => {
    if (weaveScore > STABLE_THRESHOLD) return 0.22;
    if (weaveScore > ATTENTION_THRESHOLD) return 0.25;
    return 0.30; // Attention state more visible
  }, [weaveScore]);

  const glowProgress = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const pressOpacity = useSharedValue(gradientOpacity);

  // Reset image error state when photoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  // Update intelligent status line
  useEffect(() => {
    // Special handling for Unknown archetype
    if (archetype === 'Unknown') {
      setStatusLine({ text: 'Tap to assign an archetype', icon: '✨' });
      return;
    }

    generateIntelligentStatusLine(friend)
      .then(status => setStatusLine(status))
      .catch(error => {
        console.error('Error generating status line:', error);
        setStatusLine({ text: archetypeData[archetype]?.essence || '' });
      });
  }, [friend, friend.lastUpdated, friend.weaveScore, archetype]);

  // "Just Nurtured" glow effect
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

  // Animated styles for gesture feedback
  const rowStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId.value === id;
    const targetScale = isGestureActive ? 1.02 : 1;
    const targetPressOpacity = isGestureActive ? gradientOpacity + 0.1 : gradientOpacity;

    return {
      transform: [{ scale: withSpring(targetScale, { damping: 15, stiffness: 400 }) }],
      opacity: isDormant ? 0.6 : 1,
    };
  });

  const gradientStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId.value === id;
    const targetOpacity = isGestureActive ? gradientOpacity + 0.1 : gradientOpacity;

    return {
      opacity: withTiming(targetOpacity, { duration: 150 }),
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowProgress.value, [0, 0.5, 1], [0, 0.6, 0]);
    const scaleVal = interpolate(glowProgress.value, [0, 1], [1, 1.5]);
    return {
      opacity,
      transform: [{ scale: scaleVal }]
    };
  });

  // Border color based on theme
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <Animated.View ref={animatedRef} style={rowStyle}>
      <View
        className="mx-4 mb-3 rounded-weave-card overflow-hidden"
        style={{
          borderWidth: 0.5,
          borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.15 : 0.08,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Single gradient background - health indicator */}
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, gradientStyle]}>
          <LinearGradient
            colors={[`${gradientColors[0]}`, `${gradientColors[1]}`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* "Just Nurtured" glow overlay */}
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 10 },
            glowStyle
          ]}
          pointerEvents="none"
        />

        {/* Subtle top highlight for depth */}
        <View
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
        />

        {/* Content */}
        <View className="flex-row items-center p-3 gap-3">
          {/* Avatar */}
          <View
            className="w-avatar-sm h-avatar-sm rounded-full overflow-hidden items-center justify-center"
            style={{
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
              borderWidth: 0.5,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {photoUrl && !imageError ? (
              <Image
                source={{ uri: normalizeContactImageUri(photoUrl) }}
                className="w-full h-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
                cache="force-cache"
                fadeDuration={0}
              />
            ) : (
              <Text
                className="text-lg font-semibold"
                style={{ color: colors.foreground }}
              >
                {name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Text Content */}
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text
                className="font-semibold"
                style={{
                  fontSize: 17,
                  lineHeight: 20,
                  color: colors.foreground,
                  fontFamily: 'Lora_700Bold',
                }}
                numberOfLines={1}
              >
                {name}
              </Text>
              {variant === 'full' && relationshipType && (
                <Text style={{ fontSize: 14 }}>
                  {RELATIONSHIP_ICONS[relationshipType as RelationshipType]}
                </Text>
              )}
            </View>

            <View className="flex-row items-center gap-1.5 mt-0.5">
              {statusLine.icon && (
                <Text style={{ fontSize: 12 }}>{statusLine.icon}</Text>
              )}
              <Text
                className="text-status"
                style={{ color: colors.foreground, opacity: 0.7 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {statusLine.text}
              </Text>
            </View>
          </View>

          {/* Archetype Button */}
          <View className="relative">
            <Pressable
              onLongPress={handleArchetypeLongPress}
              delayLongPress={500}
              className="w-9 h-9 rounded-[10px] items-center justify-center"
              style={{
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderWidth: 0.5,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              <ArchetypeIcon
                archetype={archetype}
                size={18}
                color={isDarkMode ? colors.foreground : colors['muted-foreground']}
              />
            </Pressable>
            {/* Unknown Archetype Indicator */}
            {archetype === 'Unknown' && (
              <View
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center"
                style={{
                  backgroundColor: '#f59e0b',
                  borderWidth: 1.5,
                  borderColor: colors.card,
                }}
              >
                <Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold' }}>!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
