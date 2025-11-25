/**
 * BadgeUnlockModal Component
 *
 * Non-intrusive top-drawer notification for new badge/achievement unlocks.
 * Shows a small banner at the top of the screen.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useUIStore } from '../stores/uiStore';
import { markBadgeAsCelebrated } from '@/modules/gamification';
import { markAchievementAsCelebrated } from '@/modules/gamification';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/shared/hooks/useTheme';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 80;

export default function BadgeUnlockModal() {
  const badgeQueue = useUIStore((state) => state.badgeUnlockQueue);
  const achievementQueue = useUIStore((state) => state.achievementUnlockQueue);
  const dismissBadge = useUIStore((state) => state.dismissBadgeUnlock);
  const dismissAchievement = useUIStore((state) => state.dismissAchievementUnlock);
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();

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

  const colors = rarityColors[item.rarity as keyof typeof rarityColors] || rarityColors.common;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View style={styles.wrapper}>
          <BlurView
            intensity={90}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.blurContainer, { borderColor: colors.border }]}
          >
            <View style={styles.content}>
              <View style={[styles.iconContainer, { backgroundColor: colors.bg }]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>

              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
                  {isHidden ? 'Hidden Discovery!' : currentBadge ? 'Badge Earned!' : 'Achievement Unlocked!'}
                </Text>
                <Text style={[styles.name, { color: colors.bg }]}>{item.name}</Text>
                {friendName && (
                  <Text style={[styles.subtitle, { color: isDarkMode ? '#ccc' : '#666' }]}>
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  wrapper: {
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Lora_700Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
