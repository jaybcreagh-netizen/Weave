import React, { useCallback } from 'react';
import { View, Pressable, Text as RNText } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutLeft,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { Suggestion } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { CachedImage } from '@/shared/ui/CachedImage';
import { icons } from 'lucide-react-native';
import FriendModel from '@/db/models/Friend';

interface SuggestionCardProps {
  suggestion: Suggestion;
  friend?: FriendModel | null;
  onAct: () => void;
  onLater: () => void;
  index?: number; // For staggered animation
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DISMISS_THRESHOLD = -80;

export function SuggestionCard({ suggestion, friend, onAct, onLater, index = 0 }: SuggestionCardProps) {
  const { colors, tokens } = useTheme();
  const translateX = useSharedValue(0);
  const isDismissing = useSharedValue(false);

  // Urgency colors mapping
  const urgencyColors = {
    critical: colors.celebrate,
    high: colors.accent,
    medium: colors.primary,
    low: colors.primary,
  };

  const urgencyColor: string = urgencyColors[suggestion.urgency || 'low'];

  // Icon handling for category badge
  const iconName = (suggestion.icon && icons[suggestion.icon as keyof typeof icons])
    ? (suggestion.icon as keyof typeof icons)
    : 'Star';

  // Get initials from friend name
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Handle dismiss with haptic
  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLater();
  }, [onLater]);

  // Pan gesture for swipe-to-dismiss
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      // Only allow leftward swipes
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (e.translationX < DISMISS_THRESHOLD && !isDismissing.value) {
        isDismissing.value = true;
        runOnJS(handleDismiss)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  // Animated style for card translation
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Animated style for dismiss indicator
  const dismissIndicatorStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / DISMISS_THRESHOLD, 1),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        entering={FadeInDown.delay(index * 80).springify().damping(14)}
        exiting={FadeOutLeft.springify().damping(12)}
        layout={LinearTransition.springify().damping(12)}
        className="mb-3"
      >
        {/* Dismiss indicator behind card */}
        <Animated.View
          className="absolute right-2 inset-y-0 justify-center"
          style={dismissIndicatorStyle}
        >
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.destructive + '20' }}
          >
            <X size={20} color={colors.destructive} />
          </View>
        </Animated.View>

        {/* Main card */}
        <Animated.View
          className="rounded-2xl border overflow-hidden"
          style={[
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderLeftWidth: 3,
              borderLeftColor: urgencyColor,
            },
            cardAnimatedStyle,
          ]}
        >
          <View className="p-4">
            <View className="flex-row items-start gap-3">
              {/* Avatar with category badge */}
              <View className="relative shrink-0">
                {friend?.photoUrl ? (
                  <CachedImage
                    source={{ uri: friend.photoUrl }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                    }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: urgencyColor + '20' }}
                  >
                    <RNText
                      style={{
                        color: urgencyColor,
                        fontSize: 18,
                        fontWeight: '700',
                      }}
                    >
                      {friend?.name ? getInitials(friend.name) : '?'}
                    </RNText>
                  </View>
                )}
                {/* Category badge */}
                <View
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center border-2"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.card,
                  }}
                >
                  <Icon name={iconName} size={12} color={urgencyColor} />
                </View>
              </View>

              <View className="flex-1">
                <View className="flex-row justify-between items-start mb-0.5">
                  <View className="flex-1 mr-2">
                    {suggestion.urgency === 'critical' && (
                      <View
                        className="self-start px-2 py-0.5 rounded-full mb-1"
                        style={{ backgroundColor: tokens.celebrateSubtle }}
                      >
                        <Text variant="caption" style={{ color: colors.celebrate, fontSize: 9, fontWeight: '700' }}>
                          SPECIAL
                        </Text>
                      </View>
                    )}
                    <Text variant="body" weight="bold" style={{ color: colors.foreground, fontSize: 15 }}>
                      {suggestion.title}
                    </Text>
                  </View>

                  {suggestion.dismissible && (
                    <Pressable
                      onPress={onLater}
                      hitSlop={8}
                      className="opacity-50 active:opacity-100 p-1"
                    >
                      <Icon name="X" size={16} color={colors['muted-foreground']} />
                    </Pressable>
                  )}
                </View>

                <Text
                  variant="body"
                  style={{
                    color: colors['muted-foreground'],
                    marginTop: 2,
                    marginBottom: 12,
                    lineHeight: 20,
                    fontSize: 13,
                  }}
                  numberOfLines={2}
                >
                  {suggestion.subtitle}
                </Text>

                <Button
                  onPress={onAct}
                  className="w-full"
                  style={{ backgroundColor: urgencyColor }}
                  label={suggestion.actionLabel}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
