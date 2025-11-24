/**
 * AchievementCard Component
 *
 * Reusable card for displaying badges and achievements
 * Used in both FriendBadgeSection and TrophyCabinetModal
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import type { BadgeDefinition } from '@/modules/gamification/constants/badge-definitions';
import type { GlobalAchievement } from '@/modules/gamification/constants/achievement-definitions';

/**
 * @interface AchievementCardProps
 * @property {BadgeDefinition | GlobalAchievement} achievement - The achievement data to display.
 * @property {boolean} unlocked - Whether the achievement is unlocked.
 * @property {() => void} [onPress] - Optional function to call when the card is pressed.
 * @property {boolean} [showProgress] - Optional flag to show the progress bar.
 * @property {number} [progress] - Optional progress value.
 * @property {number} [progressPercent] - Optional progress percentage.
 * @property {boolean} [compact] - Optional flag for a more compact layout.
 */
interface AchievementCardProps {
  achievement: BadgeDefinition | GlobalAchievement;
  unlocked: boolean;
  onPress?: () => void;
  showProgress?: boolean;
  progress?: number;
  progressPercent?: number;
  compact?: boolean;
}

/**
 * Get rarity color classes - theme-aware.
 * @param {string} rarity - The rarity of the achievement.
 * @param {boolean} isDark - Whether dark mode is enabled.
 * @returns {{border: string, bg: string, text: string, glow: string}} - The color classes.
 */
function getRarityColors(rarity: string, isDark: boolean) {
  if (isDark) {
    // Dark mode: vibrant borders, dark backgrounds, bright text
    switch (rarity) {
      case 'common':
        return {
          border: 'border-emerald-500',
          bg: 'bg-emerald-950/40',
          text: 'text-emerald-400',
          glow: 'shadow-lg shadow-emerald-500/20',
        };
      case 'rare':
        return {
          border: 'border-blue-500',
          bg: 'bg-blue-950/40',
          text: 'text-blue-400',
          glow: 'shadow-lg shadow-blue-500/20',
        };
      case 'epic':
        return {
          border: 'border-purple-500',
          bg: 'bg-purple-950/40',
          text: 'text-purple-400',
          glow: 'shadow-lg shadow-purple-500/20',
        };
      case 'legendary':
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-950/40',
          text: 'text-amber-400',
          glow: 'shadow-lg shadow-amber-500/30',
        };
      default:
        return {
          border: 'border-gray-600',
          bg: 'bg-gray-800/40',
          text: 'text-gray-400',
          glow: '',
        };
    }
  } else {
    // Light mode: softer borders, light backgrounds, darker text
    switch (rarity) {
      case 'common':
        return {
          border: 'border-emerald-400',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          glow: '',
        };
      case 'rare':
        return {
          border: 'border-blue-400',
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          glow: '',
        };
      case 'epic':
        return {
          border: 'border-purple-400',
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          glow: '',
        };
      case 'legendary':
        return {
          border: 'border-amber-400',
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          glow: '',
        };
      default:
        return {
          border: 'border-gray-400',
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          glow: '',
        };
    }
  }
}

/**
 * A reusable card component for displaying badges and achievements.
 * It can show the achievement in a locked, unlocked, or progress state.
 *
 * @param {AchievementCardProps} props - The props for the component.
 * @returns {React.ReactElement} The rendered AchievementCard component.
 */
export default function AchievementCard({
  achievement,
  unlocked,
  onPress,
  showProgress = false,
  progress = 0,
  progressPercent = 0,
  compact = false,
}: AchievementCardProps) {
  const { colors: themeColors, isDarkMode } = useTheme();
  const colors = getRarityColors(achievement.rarity, isDarkMode);

  // Render minimal locked card
  if (!unlocked && !showProgress) {
    const content = (
      <View
        className={`
          border rounded-xl overflow-hidden
          ${colors.border} ${colors.bg}
          p-3
        `}
        style={{ opacity: 0.5 }}
      >
        <View className="flex-row items-center">
          <Text className="text-2xl mr-3 opacity-40">
            {achievement.icon}
          </Text>
          <View className="flex-1">
            <Text
              className="font-['Lora'] font-semibold text-sm"
              style={{ color: themeColors['muted-foreground'] }}
              numberOfLines={1}
            >
              {achievement.name}
            </Text>
            <View className="flex-row items-center justify-between mt-1">
              <Text
                className={`font-['Inter'] text-xs uppercase tracking-wide ${colors.text}`}
              >
                {achievement.rarity}
              </Text>
              <Text
                className="font-['Inter'] text-xs"
                style={{ color: themeColors['muted-foreground'] }}
              >
                🔒 {achievement.threshold}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          {content}
        </TouchableOpacity>
      );
    }

    return content;
  }

  // Render full unlocked card or progress card
  const content = (
    <View
      className={`
        border-2 rounded-2xl overflow-hidden
        ${colors.border} ${colors.bg} ${colors.glow}
        ${compact ? 'p-3' : 'p-4'}
      `}
    >
      {/* Icon and Title Row */}
      <View className="flex-row items-center mb-2">
        <Text className="text-3xl mr-3">
          {achievement.icon}
        </Text>
        <View className="flex-1">
          <Text
            className={`font-['Lora'] font-bold ${compact ? 'text-base' : 'text-lg'}`}
            style={{ color: themeColors.foreground }}
          >
            {achievement.name}
          </Text>
          <Text
            className={`font-['Inter'] text-xs uppercase tracking-wide ${colors.text}`}
          >
            {achievement.rarity}
          </Text>
        </View>
        {unlocked && (
          <View className="bg-emerald-500 rounded-full px-2 py-1">
            <Text className="text-white text-xs font-['Inter'] font-bold">✓</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text
        className={`font-['Inter'] ${compact ? 'text-xs' : 'text-sm'} mb-2`}
        style={{ color: themeColors['muted-foreground'] }}
      >
        {achievement.description}
      </Text>

      {/* Flavor Text (if unlocked and available) */}
      {unlocked && achievement.flavorText && (
        <Text
          className="font-['Inter'] text-xs italic mb-2"
          style={{ color: themeColors['muted-foreground'], opacity: 0.8 }}
        >
          "{achievement.flavorText}"
        </Text>
      )}

      {/* Progress Bar (if showing progress) */}
      {showProgress && !unlocked && (
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text
              className="font-['Inter'] text-xs"
              style={{ color: themeColors['muted-foreground'] }}
            >
              {progress} / {achievement.threshold}
            </Text>
            <Text
              className="font-['Inter'] text-xs"
              style={{ color: themeColors['muted-foreground'] }}
            >
              {Math.round(progressPercent)}%
            </Text>
          </View>
          <View
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: themeColors.muted }}
          >
            <View
              className={`h-full rounded-full ${colors.text.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </View>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
