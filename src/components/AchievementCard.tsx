/**
 * AchievementCard Component
 *
 * Reusable card for displaying badges and achievements
 * Used in both FriendBadgeSection and TrophyCabinetModal
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { BadgeDefinition } from '../lib/badge-definitions';
import type { GlobalAchievement } from '../lib/achievement-definitions';

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
 * Get rarity color classes
 */
function getRarityColors(rarity: string, unlocked: boolean) {
  if (!unlocked) {
    return {
      border: 'border-gray-700',
      bg: 'bg-gray-800/50',
      text: 'text-gray-500',
      glow: '',
    };
  }

  switch (rarity) {
    case 'common':
      return {
        border: 'border-emerald-600',
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        glow: 'shadow-lg shadow-emerald-500/20',
      };
    case 'rare':
      return {
        border: 'border-blue-600',
        bg: 'bg-blue-950/40',
        text: 'text-blue-400',
        glow: 'shadow-lg shadow-blue-500/20',
      };
    case 'epic':
      return {
        border: 'border-purple-600',
        bg: 'bg-purple-950/40',
        text: 'text-purple-400',
        glow: 'shadow-lg shadow-purple-500/20',
      };
    case 'legendary':
      return {
        border: 'border-amber-600',
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
}

export default function AchievementCard({
  achievement,
  unlocked,
  onPress,
  showProgress = false,
  progress = 0,
  progressPercent = 0,
  compact = false,
}: AchievementCardProps) {
  const colors = getRarityColors(achievement.rarity, unlocked);

  const content = (
    <View
      className={`
        border-2 rounded-2xl overflow-hidden
        ${colors.border} ${colors.bg} ${colors.glow}
        ${compact ? 'p-3' : 'p-4'}
        ${unlocked ? '' : 'opacity-60'}
      `}
    >
      {/* Icon and Title Row */}
      <View className="flex-row items-center mb-2">
        <Text className={`text-3xl mr-3 ${unlocked ? '' : 'opacity-40'}`}>
          {achievement.icon}
        </Text>
        <View className="flex-1">
          <Text
            className={`font-['Lora'] font-bold ${compact ? 'text-base' : 'text-lg'} ${
              unlocked ? 'text-white' : 'text-gray-500'
            }`}
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
        className={`font-['Inter'] ${compact ? 'text-xs' : 'text-sm'} ${
          unlocked ? 'text-gray-300' : 'text-gray-600'
        } mb-2`}
      >
        {achievement.description}
      </Text>

      {/* Flavor Text (if unlocked and available) */}
      {unlocked && achievement.flavorText && (
        <Text className="font-['Inter'] text-xs italic text-gray-400 mb-2">
          "{achievement.flavorText}"
        </Text>
      )}

      {/* Progress Bar (if showing progress) */}
      {showProgress && !unlocked && (
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="font-['Inter'] text-xs text-gray-400">
              {progress} / {achievement.threshold}
            </Text>
            <Text className="font-['Inter'] text-xs text-gray-400">
              {Math.round(progressPercent)}%
            </Text>
          </View>
          <View className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${colors.text.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </View>
        </View>
      )}

      {/* Locked Threshold Display */}
      {!showProgress && !unlocked && (
        <Text className="font-['Inter'] text-xs text-gray-500 mt-1">
          Unlock at: {achievement.threshold}
        </Text>
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
