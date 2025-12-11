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

import { useUIStore } from '@/stores/uiStore';
import { type Archetype, type RelationshipType, type Friend } from '@/components/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { archetypeData } from '@/shared/constants/constants';
import FriendModel from '@/db/models/Friend';
import { useCardGesture } from '@/context/CardGestureContext';
import { calculateCurrentScore } from '@/modules/intelligence';
import { generateIntelligentStatusLine } from '@/modules/intelligence';
import { normalizeContactImageUri } from '../utils/image.utils';
import { resolveImageUri } from '../services/image.service';
import { statusLineCache } from '@/modules/intelligence';
import { FriendDetailSheet } from './FriendDetailSheet';
import { HydratedFriend } from '@/types/hydrated';

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

import withObservables from '@nozbe/with-observables';

export const FriendListRowContent = ({ friend, animatedRef, variant = 'default' }: FriendListRowProps) => {
  if (!friend) return null;

  const { id, name, archetype, isDormant = false, photoUrl, relationshipType } = friend;
  const [statusLine, setStatusLine] = useState<{ text: string; icon?: string; variant?: 'default' | 'accent' | 'warning' | 'success' }>({
    text: archetypeData[archetype as Archetype]?.essence || '',
    variant: 'default'
  });
  const [imageError, setImageError] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const { setArchetypeModal, justNurturedFriendId, setJustNurturedFriendId } = useUIStore();
  const { activeCardId, pendingCardId } = useCardGesture();

  // Calculate current score with decay - memoized by ID to avoid recalculation
  const weaveScore = useMemo(
    () => calculateCurrentScore(friend),
    [friend.id, friend.weaveScore, friend.lastUpdated]
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

  // Resolve photo URL
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (photoUrl) {
      resolveImageUri(photoUrl).then(uri => {
        if (uri) setResolvedPhotoUrl(uri);
      });
    } else {
      setResolvedPhotoUrl(null);
    }
  }, [photoUrl]);

  // Update intelligent status line with caching for performance
  useEffect(() => {
    // Special handling for Unknown archetype
    if (archetype === 'Unknown') {
      setStatusLine({ text: 'Tap to assign an archetype', icon: '✨', variant: 'accent' });
      return;
    }

    // Try cache first
    const cacheKey = {
      friendId: friend.id,
      lastUpdated: friend.lastUpdated.getTime(),
      weaveScore: friend.weaveScore,
      archetype: friend.archetype,
    };

    const cached = statusLineCache.get(cacheKey);
    if (cached) {
      setStatusLine(cached);
      return;
    }

    // Generate and cache if not found
    const timeoutId = setTimeout(() => {
      generateIntelligentStatusLine(friend as unknown as HydratedFriend)
        .then(status => {
          statusLineCache.set(cacheKey, status);
          setStatusLine(status);
        })
        .catch(error => {
          console.error('Error generating status line:', error);
          const fallback = { text: archetypeData[archetype as Archetype]?.essence || '', variant: 'default' as const };
          setStatusLine(fallback);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [friend.id, friend.lastUpdated.getTime(), friend.weaveScore, archetype]);

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

  const handleCardLongPress = () => {
    // Only allow long press on friend profile page (variant='full'), not on dashboard
    if (variant !== 'full') return;

    setShowDetailSheet(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Animated styles for gesture feedback
  const rowStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId.value === id;
    const isPending = pendingCardId.value === id;

    // During pending: smooth continuous growth, during active: slightly larger
    let targetScale = 1;
    if (isGestureActive) {
      targetScale = 1.03;
    } else if (isPending) {
      targetScale = 1.03; // Grows to same as active for seamless transition
    }

    // Use timing with easeOut for smooth continuous growth (no "tick tick")
    return {
      transform: [{
        scale: withTiming(targetScale, {
          duration: isPending ? 260 : 150, // Match long-press duration for pending, quick return otherwise
          easing: Easing.out(Easing.quad)
        })
      }],
      opacity: isDormant ? 0.6 : 1,
    };
  });

  const gradientStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId.value === id;
    const isPending = pendingCardId.value === id;

    // Gradient grows smoothly more visible during pending/active states
    let targetOpacity = gradientOpacity;
    if (isGestureActive || isPending) {
      targetOpacity = gradientOpacity + 0.12; // Same target for seamless transition
    }

    return {
      opacity: withTiming(targetOpacity, {
        duration: (isGestureActive || isPending) ? 260 : 150,
        easing: Easing.out(Easing.quad)
      }),
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

  // Determine status text color based on variant
  const getStatusColor = () => {
    switch (statusLine.variant) {
      case 'accent':
        return isDarkMode ? '#A78BFA' : '#7C3AED'; // Violet/Purple
      case 'warning':
        return isDarkMode ? '#F87171' : '#DC2626'; // Red
      case 'success':
        return isDarkMode ? '#34D399' : '#059669'; // Emerald/Green
      default:
        return colors.foreground;
    }
  };

  const statusColor = getStatusColor();

  return (
    <Animated.View ref={animatedRef} style={rowStyle}>
      <View
        className={`mb-3 rounded-weave-card overflow-hidden ${variant === 'full' ? '' : 'mx-4'}`}
        style={{
          borderWidth: 0.5,
          borderColor,
          backgroundColor: colors.background,
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
        <Pressable
          onLongPress={handleCardLongPress}
          delayLongPress={500}
          className="flex-row items-center p-3 gap-3"
        >
          {/* Avatar */}
          <View
            className="w-avatar-sm h-avatar-sm rounded-full overflow-hidden items-center justify-center"
            style={{
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
              borderWidth: 0.5,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {resolvedPhotoUrl && !imageError ? (
              <Image
                source={{ uri: normalizeContactImageUri(resolvedPhotoUrl) }}
                className="w-full h-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
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
                style={{
                  color: statusColor,
                  opacity: statusLine.variant === 'default' ? 0.7 : 0.9,
                  fontWeight: statusLine.variant !== 'default' ? '500' : '400'
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {statusLine.text}
              </Text>
            </View>
          </View>

          {/* Archetype Icon */}
          <View className="relative">
            <View
              className="w-9 h-9 rounded-[10px] items-center justify-center"
              style={{
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderWidth: 0.5,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              <ArchetypeIcon
                archetype={archetype as Archetype}
                size={18}
                color={isDarkMode ? '#FFFFFF' : colors['muted-foreground']}
              />
            </View>
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
        </Pressable>
      </View>

      {/* Friend Detail Sheet */}
      <FriendDetailSheet
        isVisible={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        friendId={friend.id}
      />
    </Animated.View>
  );
};

export const FriendListRow = withObservables(['friend'], ({ friend }: { friend: FriendModel }) => ({
  friend: friend.observe(),
}))(FriendListRowContent);
