/**
 * FriendBadgeSection Component
 *
 * Displays relationship milestone badges on a friend's profile
 * Shows earned badges and progress toward next milestone
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { database } from '../db';
import FriendBadge from '../db/models/FriendBadge';
import { Q } from '@nozbe/watermelondb';
import {
  getBadgeById,
  WEAVE_COUNT_BADGES,
  DEPTH_BADGES,
  CONSISTENCY_BADGES,
  SPECIAL_BADGES,
  type BadgeDefinition,
} from '../lib/badge-definitions';
import { calculateFriendBadgeProgress, type BadgeProgress } from '../lib/badge-calculator';
import AchievementCard from './AchievementCard';

interface FriendBadgeSectionProps {
  friendId: string;
  friendName: string;
}

function FriendBadgeSectionComponent({ friendId, friendName }: FriendBadgeSectionProps) {
  const [unlockedBadges, setUnlockedBadges] = useState<BadgeDefinition[]>([]);
  const [progressData, setProgressData] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    // Set loading state immediately
    setLoading(true);

    async function loadBadgeData() {
      try {
        // Load unlocked badges
        const badges = await database
          .get<FriendBadge>('friend_badges')
          .query(Q.where('friend_id', friendId), Q.sortBy('unlocked_at', Q.desc))
          .fetch();

        if (isCancelled || !isMountedRef.current) return;

        const unlockedDefs = badges
          .map(b => getBadgeById(b.badgeId))
          .filter((b): b is BadgeDefinition => b !== null);

        // Calculate progress
        const progress = await calculateFriendBadgeProgress(friendId);

        if (isCancelled || !isMountedRef.current) return;

        setUnlockedBadges(unlockedDefs);
        setProgressData(progress);
        setLoading(false);
      } catch (error) {
        console.error('Error loading badge data:', error);
        if (!isCancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadBadgeData();

    return () => {
      isCancelled = true;
    };
  }, [friendId]);

  if (loading) {
    return null;
  }

  const categoryLabels = {
    weave_count: '🌱 Connection Milestones',
    depth: '📚 Reflection Depth',
    consistency: '🔥 Consistency Streak',
    special: '✨ Special Moments',
  };

  return (
    <View className="px-4 py-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-['Lora'] text-xl font-bold">
          Relationship Badges
        </Text>
        <View className="bg-emerald-500/20 px-3 py-1 rounded-full">
          <Text className="text-emerald-400 font-['Inter'] text-sm font-bold">
            {unlockedBadges.length} Earned
          </Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View className="flex-row gap-2 mb-4">
        {progressData.slice(0, 3).map((cat) => {
          const emoji = categoryLabels[cat.categoryType as keyof typeof categoryLabels]?.split(' ')[0] || '🏆';
          return (
            <View
              key={cat.categoryType}
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl p-3"
            >
              <Text className="text-2xl mb-1">{emoji}</Text>
              <Text className="text-white font-['Inter'] text-xs">
                Tier {cat.currentTier}
              </Text>
              {cat.nextBadge && (
                <Text className="text-gray-400 font-['Inter'] text-xs">
                  {Math.round(cat.progressPercent)}% to next
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Category Sections */}
      {progressData.map((catProgress) => {
        const categoryKey = catProgress.categoryType as keyof typeof categoryLabels;
        const label = categoryLabels[categoryKey] || catProgress.categoryType;
        const isExpanded = expandedCategory === catProgress.categoryType;

        return (
          <View key={catProgress.categoryType} className="mb-3">
            {/* Category Header */}
            <TouchableOpacity
              onPress={() =>
                setExpandedCategory(isExpanded ? null : catProgress.categoryType)
              }
              className="flex-row items-center justify-between py-2 mb-2"
            >
              <Text className="text-white font-['Inter'] text-base font-semibold">
                {label}
              </Text>
              <Text className="text-gray-400 font-['Inter'] text-sm">
                {isExpanded ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View className="space-y-3">
                {/* Current Badge (if unlocked) */}
                {catProgress.currentBadge && (
                  <AchievementCard
                    achievement={catProgress.currentBadge}
                    unlocked={true}
                    compact={true}
                  />
                )}

                {/* Next Badge with Progress */}
                {catProgress.nextBadge && (
                  <AchievementCard
                    achievement={catProgress.nextBadge}
                    unlocked={false}
                    showProgress={true}
                    progress={catProgress.progress}
                    progressPercent={catProgress.progressPercent}
                    compact={true}
                  />
                )}

                {/* Max Tier Reached */}
                {!catProgress.nextBadge && catProgress.currentBadge && (
                  <View className="bg-amber-950/30 border border-amber-700 rounded-xl p-3">
                    <Text className="text-amber-400 font-['Inter'] text-sm text-center">
                      🏆 Maximum tier reached!
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Special Badges Gallery */}
      {unlockedBadges.filter(b => SPECIAL_BADGES.some(sb => sb.id === b.id)).length > 0 && (
        <View className="mt-4">
          <Text className="text-white font-['Inter'] text-base font-semibold mb-2">
            ✨ Special Moments
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row gap-3"
          >
            {unlockedBadges
              .filter(b => SPECIAL_BADGES.some(sb => sb.id === b.id))
              .map((badge) => (
                <View key={badge.id} className="w-40">
                  <AchievementCard achievement={badge} unlocked={true} compact={true} />
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Empty State */}
      {unlockedBadges.length === 0 && (
        <View className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 items-center">
          <Text className="text-4xl mb-3">🌱</Text>
          <Text className="text-white font-['Lora'] text-base font-semibold mb-1 text-center">
            Start Your Journey
          </Text>
          <Text className="text-gray-400 font-['Inter'] text-sm text-center">
            Log interactions with {friendName} to earn relationship badges!
          </Text>
        </View>
      )}
    </View>
  );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(FriendBadgeSectionComponent);
