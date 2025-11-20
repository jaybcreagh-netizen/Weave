/**
 * BadgeUnlockModal Component
 *
 * Celebration modal for new badge/achievement unlocks
 * Shows unlock with animation and confetti
 * Pulls from unlock queue in uiStore
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useUIStore } from '../stores/uiStore';
import { markBadgeAsCelebrated } from '@/modules/gamification';
import { markAchievementAsCelebrated } from '@/modules/gamification';

const { width, height } = Dimensions.get('window');

export default function BadgeUnlockModal() {
  const badgeQueue = useUIStore((state) => state.badgeUnlockQueue);
  const achievementQueue = useUIStore((state) => state.achievementUnlockQueue);
  const dismissBadge = useUIStore((state) => state.dismissBadgeUnlock);
  const dismissAchievement = useUIStore((state) => state.dismissAchievementUnlock);
  const [isDismissing, setIsDismissing] = React.useState(false);

  // Badge takes priority over achievements
  const currentBadge = badgeQueue[0];
  const currentAchievement = !currentBadge ? achievementQueue[0] : null;

  const visible = !!(currentBadge || currentAchievement) && !isDismissing;

  // Animation values
  const scale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Reset animations
      scale.value = 0;
      iconScale.value = 0;
      opacity.value = 0;

      // Trigger entrance animation
      opacity.value = withSpring(1);
      scale.value = withSequence(
        withSpring(1.05, { damping: 20 }),
        withSpring(1, { damping: 20 })
      );
      iconScale.value = withDelay(
        200,
        withSequence(
          withSpring(1.1, { damping: 18 }),
          withSpring(1, { damping: 20 })
        )
      );
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  async function handleDismiss() {
    setIsDismissing(true);

    try {
      if (currentBadge) {
        // Mark badge as celebrated in database
        await markBadgeAsCelebrated(currentBadge.badge.id, currentBadge.friendId);
        // Remove from queue
        dismissBadge();
      } else if (currentAchievement) {
        // Mark achievement as celebrated in database
        await markAchievementAsCelebrated(currentAchievement.achievement.id);
        // Remove from queue
        dismissAchievement();
      }
    } finally {
      // Small delay to prevent flickering
      setTimeout(() => {
        setIsDismissing(false);
      }, 300);
    }
  }

  if (!visible) return null;

  const item = currentBadge?.badge || currentAchievement?.achievement;
  const friendName = currentBadge?.friendName;
  const isHidden = currentAchievement?.isHidden;

  if (!item) return null;

  // Get rarity color
  const rarityColors = {
    common: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
    rare: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
    epic: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
    legendary: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' },
  };

  const colors = rarityColors[item.rarity] || rarityColors.common;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center px-6">
        <Animated.View style={[containerStyle]} className="w-full max-w-sm">
          {/* Glow Effect */}
          <View
            className={`absolute inset-0 ${colors.bg} opacity-20 blur-3xl rounded-3xl`}
            style={{ transform: [{ scale: 1.2 }] }}
          />

          {/* Main Card */}
          <View className="bg-gray-900 border-2 rounded-3xl p-6 items-center">
            {/* Header */}
            <Text className="text-white font-['Lora'] text-2xl font-bold mb-2">
              {isHidden ? 'Hidden Discovery!' : currentBadge ? 'Badge Earned!' : 'Achievement Unlocked!'}
            </Text>

            {/* Friend Name (for badges) */}
            {friendName && (
              <View className={`${colors.bg} rounded-full px-4 py-1 mb-4`}>
                <Text className="text-white font-['Inter'] text-sm font-bold">
                  {friendName}
                </Text>
              </View>
            )}

            {/* Icon */}
            <Animated.View style={[iconStyle]} className="mb-4">
              <View
                className={`w-32 h-32 ${colors.bg} rounded-full items-center justify-center`}
                style={styles.iconContainer}
              >
                <Text style={styles.iconText}>{item.icon}</Text>
              </View>
            </Animated.View>

            {/* Achievement Name */}
            <Text className="text-white font-['Lora'] text-2xl font-bold text-center mb-2">
              {item.name}
            </Text>

            {/* Rarity Badge */}
            <View className={`border ${colors.border} rounded-full px-3 py-1 mb-4`}>
              <Text className={`${colors.text} font-['Inter'] text-xs uppercase tracking-wide font-bold`}>
                {item.rarity}
              </Text>
            </View>

            {/* Description */}
            <Text className="text-gray-300 font-['Inter'] text-base text-center mb-2">
              {item.description}
            </Text>

            {/* Flavor Text */}
            {item.flavorText && (
              <Text className="text-gray-400 font-['Inter'] text-sm italic text-center mb-6">
                "{item.flavorText}"
              </Text>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleDismiss}
              className={`${colors.bg} rounded-2xl px-8 py-4 w-full items-center`}
              activeOpacity={0.8}
            >
              <Text className="text-white font-['Inter'] text-lg font-bold">
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconText: {
    fontSize: 64,
  },
});
