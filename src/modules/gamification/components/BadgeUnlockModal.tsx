/**
 * BadgeUnlockModal Component
 *
 * Non-intrusive top-drawer notification for new badge/achievement unlocks.
 * Shows a small banner at the top of the screen.
 */

import React, { useEffect } from 'react';
import {
  View,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useUIStore } from '@/shared/stores/uiStore';
import { markBadgeAsCelebrated } from '../services/badge.service';
import { markAchievementAsCelebrated } from '../services/achievement.service';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';

const { width } = Dimensions.get('window');

export function BadgeUnlockModal() {
  const badgeQueue = useUIStore((state) => state.badgeUnlockQueue);
  const achievementQueue = useUIStore((state) => state.achievementUnlockQueue);
  const dismissBadge = useUIStore((state) => state.dismissBadgeUnlock);
  const dismissAchievement = useUIStore((state) => state.dismissAchievementUnlock);
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();

  // Badge takes priority over achievements
  const currentBadge = badgeQueue[0];
  const currentAchievement = !currentBadge ? achievementQueue[0] : null;

  const visible = !!(currentBadge || currentAchievement);
  const translateY = useSharedValue(-200);

  useEffect(() => {
    if (visible) {
      // Slide in
      translateY.value = withSpring(0, { damping: 15 });

      // Auto dismiss after 4 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      translateY.value = -200;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  async function handleDismiss() {
    // Slide out first
    translateY.value = withTiming(-200, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(cleanup)();
      }
    });
  }

  async function cleanup() {
    try {
      if (currentBadge) {
        await markBadgeAsCelebrated(currentBadge.badge.id, currentBadge.friendId);
        dismissBadge();
      } else if (currentAchievement) {
        await markAchievementAsCelebrated(currentAchievement.achievement.id);
        dismissAchievement();
      }
    } catch (error) {
      console.error('Error dismissing badge/achievement:', error);
    }
  }

  // Swipe up gesture
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY < -20 || event.velocityY < -500) {
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  if (!visible) return null;

  const item = currentBadge?.badge || currentAchievement?.achievement;
  const friendName = currentBadge?.friendName;
  const isHidden = currentAchievement?.isHidden;

  if (!item) return null;

  // Get rarity color
  const rarityColors = {
    common: { bg: '#10b981', border: '#059669' }, // emerald-500
    rare: { bg: '#3b82f6', border: '#2563eb' }, // blue-500
    epic: { bg: '#a855f7', border: '#7c3aed' }, // purple-500
    legendary: { bg: '#f59e0b', border: '#d97706' }, // amber-500
  };

  const rarity = item.rarity as keyof typeof rarityColors || 'common';
  const rarityColor = rarityColors[rarity] || rarityColors.common;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        className="absolute top-0 left-0 right-0 items-center z-50 px-4"
        style={[
          animatedStyle,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View
          className="w-full max-w-[400px] shadow-lg"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <BlurView
            intensity={90}
            tint={isDarkMode ? 'dark' : 'light'}
            className="rounded-2xl overflow-hidden border"
            style={{ borderColor: rarityColor.border }}
          >
            <View className="flex-row items-center p-3 gap-3">
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: rarityColor.bg }}
              >
                <Text className="text-2xl">{item.icon}</Text>
              </View>

              <View className="flex-1 justify-center">
                <Text
                  className="text-xs uppercase tracking-wider mb-0.5 font-sans-semibold"
                  style={{ color: isDarkMode ? '#fff' : '#000' }}
                >
                  {isHidden ? 'Hidden Discovery!' : currentBadge ? 'Badge Earned!' : 'Achievement Unlocked!'}
                </Text>
                <Text
                  variant="h3"
                  className="text-base mb-0.5"
                  style={{ color: rarityColor.bg, fontFamily: 'Lora_700Bold' }}
                >
                  {item.name}
                </Text>
                {friendName && (
                  <Text variant="caption" style={{ color: isDarkMode ? '#ccc' : '#666' }}>
                    with {friendName}
                  </Text>
                )}
              </View>
            </View>
          </BlurView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
