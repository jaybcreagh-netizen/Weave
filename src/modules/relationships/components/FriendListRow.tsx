import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView, InteractionManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  type AnimatedRef,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useUIStore } from '@/shared/stores/uiStore';
import { type Archetype, type RelationshipType, type Friend } from '@/shared/types/legacy-types';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/modules/intelligence';
import { archetypeData } from '@/shared/constants/constants';
import FriendModel from '@/db/models/Friend';
import { FriendShape } from '@/shared/types/derived';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { calculateCurrentScore } from '@/modules/intelligence';
import { generateIntelligentStatusLine } from '@/modules/intelligence';
import { normalizeContactImageUri } from '../utils/image.utils';
import { resolveImageUri } from '../services/image.service';
import { statusLineCache } from '@/modules/intelligence';
import { FriendDetailSheet } from './FriendDetailSheet';
import { HydratedFriend } from '@/types/hydrated';
import { ArchetypeCard } from '@/modules/intelligence';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { CachedImage } from '@/shared/ui';
import { database } from '@/db';
import Intention from '@/db/models/Intention';
import { Q } from '@nozbe/watermelondb';
import { StatusLineIcon } from '@/shared/components/StatusLineIcon';
import { Sparkles, Handshake, Users, Heart, Briefcase, Home, GraduationCap, Palette, Target, Star, type LucideIcon } from 'lucide-react-native';

const ATTENTION_THRESHOLD = 35;
const STABLE_THRESHOLD = 65;

// Relationship type icon mapping
const RELATIONSHIP_ICONS: Record<RelationshipType, LucideIcon> = {
  friend: Handshake,
  family: Users,
  partner: Heart,
  colleague: Briefcase,
  neighbor: Home,
  mentor: GraduationCap,
  creative: Palette,
};

interface FriendListRowProps {
  friend: FriendModel | FriendShape;
  animatedRef?: AnimatedRef<Animated.View>;
  variant?: 'default' | 'full' | 'compact';
  onPress?: (friend: FriendModel) => void;
}


export const FriendListRowContent = ({ friend, animatedRef, variant = 'default', onPress }: FriendListRowProps) => {

  if (!friend) return null;

  const { id, name, archetype, isDormant = false, photoUrl, relationshipType } = friend;
  const [statusLine, setStatusLine] = useState<{ text: string; icon?: string; variant?: 'default' | 'accent' | 'warning' | 'success' }>({
    text: archetypeData[archetype as Archetype]?.essence || '',
    variant: 'default'
  });
  const [hasIntention, setHasIntention] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showArchetypePicker, setShowArchetypePicker] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const setArchetypeModal = useUIStore(state => state.setArchetypeModal);
  const justNurturedFriendId = useUIStore(state => state.justNurturedFriendId);
  const setJustNurturedFriendId = useUIStore(state => state.setJustNurturedFriendId);
  const gestureContext = useCardGesture({ optional: true });
  const activeCardId = gestureContext?.activeCardId;
  const pendingCardId = gestureContext?.pendingCardId;

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
  const pressOpacity = useSharedValue(1); // Replaces Pressable opacity effect

  // Reset image error state when photoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  // Resolve photo URL synchronously for performance
  const resolvedPhotoUrl = useMemo(() => {
    if (!photoUrl) return null;
    // If it's a relative path (common case), prepend document directory synchronously
    if (!photoUrl.startsWith('file://') && !photoUrl.startsWith('/')) {
      return `${FileSystem.documentDirectory}${photoUrl.replace(/^\//, '')}`;
    }
    // For absolute paths, we assume they are valid or let Image onError handle it
    return photoUrl;
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

    // Generate and cache if not found - deferred to avoid blocking animations
    // Using InteractionManager to wait for tab switch animations to complete
    const handle = InteractionManager.runAfterInteractions(() => {
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
    });

    return () => handle.cancel();
  }, [friend.id, friend.lastUpdated.getTime(), friend.weaveScore, archetype]);

  // Check for active intentions
  useEffect(() => {
    const query = database.get<Intention>('intentions').query(
      Q.where('status', 'active')
    );

    const subscription = query.observe().subscribe(async (activeIntentions) => {
      // Check if any active intention is linked to this friend
      let found = false;
      // Use for..of for async break capability
      for (const intention of activeIntentions) {
        try {
          const count = await intention.intentionFriends
            .extend(Q.where('friend_id', id))
            .fetchCount();
          if (count > 0) {
            found = true;
            break;
          }
        } catch (e) {
          // ignore error
        }
      }
      setHasIntention(found);
    });

    return () => subscription.unsubscribe();
  }, [id]);

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
    return;
  };

  // Handle tap to assign archetype for Unknown archetypes
  // AND open detail sheet for Full variant
  const handleCardPress = () => {
    if (archetype === 'Unknown') {
      console.log(`[FriendListRow] Opening archetype picker for friend: ${name} (id: ${id}), archetype: ${archetype}`);
      setShowArchetypePicker(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (variant === 'full') {
      // New behavior: Open detail sheet on tap
      setShowDetailSheet(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Handle archetype selection
  const handleArchetypeSelect = async (selectedArchetype: Archetype) => {
    try {
      await database.write(async () => {
        await friend.update((f) => {
          f.archetype = selectedArchetype;
        });
      });
      setShowArchetypePicker(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating archetype:', error);
    }
  };

  // Animated styles for gesture feedback
  const rowStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId?.value === id;
    const isPending = pendingCardId?.value === id;

    // During pending: smooth continuous growth, during active: slightly larger
    let targetScale = 1;
    if (isGestureActive) {
      targetScale = 1.03;
    } else if (isPending) {
      targetScale = 1.03; // Grows to same as active for seamless transition
    }

    // Combine gesture scale with local press scale
    const finalScale = targetScale * pressScale.value;

    return {
      transform: [{
        scale: withTiming(finalScale, {
          duration: isPending ? 260 : 150, // Match long-press duration for pending, quick return otherwise
          easing: Easing.out(Easing.quad)
        })
      }],
      opacity: (isDormant ? 0.6 : 1) * pressOpacity.value,
    };
  });

  const gradientStyle = useAnimatedStyle(() => {
    const isGestureActive = activeCardId?.value === id;
    const isPending = pendingCardId?.value === id;

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

  // Determine card height/padding based on variant
  const isCompact = variant === 'compact';
  const containerPadding = isCompact ? 'p-2' : 'p-3';
  const containerMargin = isCompact ? 'mb-2' : 'mb-3';
  const avatarSize = isCompact ? 'w-10 h-10' : 'w-12 h-12';
  const nameSize = isCompact ? 15 : 17;
  const showStatusIcon = !isCompact;

  // Gestures for New Architecture
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onBegin(() => {
      // Visual feedback on press down
      pressOpacity.value = withTiming(0.8, { duration: 100 });
      pressScale.value = withTiming(0.98, { duration: 100 });
    })
    .onFinalize(() => {
      // Reset feedback
      pressOpacity.value = withTiming(1, { duration: 150 });
      pressScale.value = withTiming(1, { duration: 150 });
    })
    .onEnd(() => {
      if (onPress) {
        onPress(friend);
      } else {
        handleCardPress();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(500)
    .onStart(() => {
       if (variant !== 'full' && handleCardLongPress) {
          handleCardLongPress();
       }
    });

  const composedGesture = Gesture.Race(longPressGesture, tapGesture);

  return (
    <Animated.View ref={animatedRef} style={rowStyle}>
      <View
        className={`${containerMargin} rounded-2xl overflow-hidden ${variant === 'full' ? '' : 'mx-4'}`}
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

        {/* Content using GestureDetector for New Architecture compatibility */}
        <GestureDetector gesture={composedGesture}>
          <View className={`flex-row items-center ${containerPadding} gap-3`}>
            {/* Avatar */}
            <View
              className={`rounded-full overflow-hidden items-center justify-center ${avatarSize}`}
              style={{
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                borderWidth: 0.5,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              {resolvedPhotoUrl && !imageError ? (
                <CachedImage
                  source={{ uri: normalizeContactImageUri(resolvedPhotoUrl) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Text
                  className="font-semibold"
                  style={{ color: colors.foreground, fontSize: isCompact ? 16 : 18 }}
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
                    fontSize: nameSize,
                    lineHeight: nameSize + 4,
                    color: colors.foreground,
                    fontFamily: 'Lora_700Bold',
                  }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {variant === 'full' && relationshipType && (
                  (() => {
                    const RelIcon = RELATIONSHIP_ICONS[relationshipType as RelationshipType];
                    return RelIcon ? <RelIcon size={14} color={colors.primary} /> : null;
                  })()
                )}
              </View>

              <View className="flex-row items-center gap-1.5 mt-0.5">
                {statusLine.icon && showStatusIcon && (
                  <StatusLineIcon icon={statusLine.icon} size={12} color={colors.primary} />
                )}
                <Text
                  className="text-status"
                  style={{
                    color: statusColor,
                    opacity: statusLine.variant === 'default' ? 0.7 : 0.9,
                    fontWeight: statusLine.variant !== 'default' ? '500' : '400',
                    fontSize: 12
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
                className="w-10 h-10 rounded-[10px] items-center justify-center"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  borderWidth: 0.5,
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  transform: [{ scale: isCompact ? 0.9 : 1 }]
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

              {/* Active Intention Indicator */}
              {hasIntention && (
                <View
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colors.primary,
                    borderWidth: 1.5,
                    borderColor: colors.card,
                    opacity: 0.6,
                  }}
                >
                  <Star size={8} color="white" fill="white" />
                </View>
              )}
            </View>
          </View>
        </GestureDetector>
      </View >

      {/* Friend Detail Sheet */}
      < FriendDetailSheet
        isVisible={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        friendId={friend.id}
      />

      {/* Quick Archetype Picker Sheet */}
      < StandardBottomSheet
        visible={showArchetypePicker}
        onClose={() => setShowArchetypePicker(false)}
        height="full"
        title={`Choose ${name}'s Archetype`}
        scrollable
      >
        <View className="px-5 pb-6">
          <Text
            className="text-sm mb-4 text-center"
            style={{ color: colors['muted-foreground'] }}
          >
            Tap to select • Long-press to learn more
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {(['Emperor', 'Empress', 'HighPriestess', 'Fool', 'Sun', 'Hermit', 'Magician', 'Lovers'] as Archetype[]).map((arch) => (
              <View key={arch} style={{ width: '48%' }}>
                <ArchetypeCard
                  archetype={arch}
                  isSelected={false}
                  onSelect={handleArchetypeSelect}
                />
              </View>
            ))}
          </View>
        </View>
      </StandardBottomSheet >
    </Animated.View >
  );
};

/**
 * FriendListRow - Optimized for performance
 * 
 * Previously used withObservables which created N subscriptions for N friends.
 * Now uses React.memo with shallow comparison - parent (FriendTierList) provides
 * reactive friends via its own observable.
 */
export const FriendListRow = React.memo(FriendListRowContent, (prevProps, nextProps) => {
  // Only re-render if friend identity or core display data changed
  if (prevProps.friend.id !== nextProps.friend.id) return false;
  if (prevProps.friend._raw._status !== nextProps.friend._raw._status) return false;
  if (prevProps.variant !== nextProps.variant) return false;
  // Compare key display fields
  if (prevProps.friend.name !== nextProps.friend.name) return false;
  if (prevProps.friend.archetype !== nextProps.friend.archetype) return false;
  if (prevProps.friend.weaveScore !== nextProps.friend.weaveScore) return false;
  if (prevProps.friend.photoUrl !== nextProps.friend.photoUrl) return false;
  return true;
});
