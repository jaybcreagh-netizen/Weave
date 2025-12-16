/**
 * FriendBadgePopup Component
 *
 * Enhanced popup showing comprehensive friend information:
 * - Archetype and personality
 * - Total weaves logged
 * - Birthday (if set)
 * - Favorite weave types (pattern recognition)
 * - Relationship badges earned
 *
 * Theme-aware and triggered by long-press on friend card
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { database } from '@/db';
import FriendBadge from '@/db/models/FriendBadge';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { getBadgeById } from '@/modules/gamification';
import { analyzeInteractionPattern } from '@/modules/insights';
import { archetypeData } from '@/shared/constants/constants';
import { CATEGORY_METADATA } from '@/shared/constants/interaction-categories';

import { useTheme } from '@/shared/hooks/useTheme';
import type { Archetype, InteractionCategory } from '@/shared/types/legacy-types';
import Logger from '@/shared/utils/Logger';
import { analyzeTierFit, getTierFitSummary } from '@/modules/insights';
import type { TierFitAnalysis } from '@/modules/insights';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FriendBadgePopupProps {
  visible: boolean;
  onClose: () => void;
  friendId: string;
  friendName: string;
}

interface FriendStats {
  archetype: Archetype;
  totalWeaves: number;
  birthday?: Date;
  favoriteWeaveTypes: InteractionCategory[];
  badgeCount: number;
  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
  }>;
  tierFit?: TierFitAnalysis;
}

export default function FriendBadgePopup({
  visible,
  onClose,
  friendId,
  friendName,
}: FriendBadgePopupProps) {
  const [stats, setStats] = useState<FriendStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBadges, setShowBadges] = useState(false);
  const { colors, isDarkMode } = useTheme();

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      loadFriendStats();
      // Entrance animation
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    } else {
      // Exit animation
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
    }
  }, [visible]);

  async function loadFriendStats() {
    setLoading(true);

    try {
      Logger.debug('[FriendBadgePopup] Loading stats for friend:', friendId);

      // Load friend data
      const friend = await database.get<Friend>('friends').find(friendId);
      Logger.debug('[FriendBadgePopup] Friend loaded:', friend.name, friend.archetype);

      // Load interactions for pattern analysis
      const interactionFriends = await database
        .get('interaction_friends')
        .query(Q.where('friend_id', friendId))
        .fetch();

      Logger.debug('[FriendBadgePopup] InteractionFriends count:', interactionFriends.length);

      const interactionIds = interactionFriends.map(
        (if_: any) => if_.interactionId || if_.interaction_id || (if_._raw && if_._raw.interaction_id)
      ).filter(Boolean);

      Logger.debug('[FriendBadgePopup] Extracted interaction IDs:', interactionIds.length);

      const interactions = await database
        .get('interactions')
        .query(Q.where('id', Q.oneOf(interactionIds)))
        .fetch();

      Logger.debug('[FriendBadgePopup] Interactions loaded:', interactions.length);

      // Analyze pattern to get favorite weave types
      const pattern = analyzeInteractionPattern(
        interactions.map((i: any) => ({
          id: i.id,
          interactionDate: new Date(i.interactionDate),
          status: i.status,
          category: i.category,
        }))
      );

      Logger.debug('[FriendBadgePopup] Pattern analyzed:', pattern.preferredCategories);

      // Load badges with details
      const badgeRecords = await database
        .get<FriendBadge>('friend_badges')
        .query(Q.where('friend_id', friendId), Q.sortBy('unlocked_at', Q.desc))
        .fetch();

      Logger.debug('[FriendBadgePopup] Badges count:', badgeRecords.length);

      const badgesWithDetails = badgeRecords
        .map(b => getBadgeById(b.badgeId))
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          rarity: b.rarity,
        }));

      const newStats = {
        archetype: friend.archetype as Archetype,
        // Use interactionFriends count as the source of truth for "Total Weaves"
        // This is more robust as it represents the links, even if the interaction objects fetch has issues
        totalWeaves: interactionFriends.length,
        birthday: friend.birthday ? new Date(friend.birthday) : undefined,
        favoriteWeaveTypes: pattern.preferredCategories,
        badgeCount: badgeRecords.length,
        badges: badgesWithDetails,
        tierFit: await analyzeTierFit(friend),
      };

      Logger.debug('[FriendBadgePopup] Setting stats:', newStats);
      setStats(newStats);
    } catch (error) {
      Logger.error('[FriendBadgePopup] Error loading friend stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const archetypeInfo = stats ? archetypeData[stats.archetype] : null;

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return '#10b981'; // emerald-500
      case 'rare':
        return '#3b82f6'; // blue-500
      case 'epic':
        return '#a855f7'; // purple-500
      case 'legendary':
        return '#f59e0b'; // amber-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Animated.View className="absolute inset-0 bg-black/50" style={backdropStyle}>
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Content Card */}
        <Animated.View
          className="h-[75%] rounded-t-3xl overflow-hidden"
          style={containerStyle}
        >
          <BlurView
            intensity={95}
            tint={isDarkMode ? 'dark' : 'light'}
            className="flex-1 rounded-t-3xl pb-5"
          >
            {/* Handle Bar */}
            <View
              className="w-10 h-1 rounded-full self-center mt-3 mb-2"
              style={{ backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)' }}
            />

            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b" style={{ borderBottomColor: colors.border }}>
              <View className="flex-1">
                <Text className="text-2xl font-lora-bold font-bold" style={{ color: colors.foreground }}>
                  {friendName}
                </Text>
                <Text className="text-sm font-inter-regular mt-0.5" style={{ color: colors['muted-foreground'] }}>
                  Friend Overview
                </Text>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {(() => {
                return null;
              })()}
              {loading ? (
                <View className="p-10 items-center">
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    Loading...
                  </Text>
                </View>
              ) : stats ? (
                <>
                  {/* Archetype Section */}
                  {archetypeInfo && (
                    <View className="px-5 py-3">
                      <Text className="text-base font-inter-bold font-bold mb-3" style={{ color: colors.foreground }}>
                        Archetype
                      </Text>
                      <View className="flex-row rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.muted }}>
                        <Text className="text-5xl">{archetypeInfo.icon}</Text>
                        <View className="flex-1 gap-1">
                          <Text className="text-lg font-lora-bold font-bold" style={{ color: colors.foreground }}>
                            {archetypeInfo.name}
                          </Text>
                          <Text className="text-sm font-inter-regular italic" style={{ color: colors['muted-foreground'] }}>
                            {archetypeInfo.essence}
                          </Text>
                          <Text className="text-xs font-inter-regular mt-0.5" style={{ color: colors['muted-foreground'] }}>
                            {archetypeInfo.careStyle}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Connection Health Section */}
                  {stats.tierFit && stats.tierFit.fitCategory !== 'insufficient_data' && (
                    <View className="px-5 py-3">
                      <Text className="text-base font-inter-bold font-bold mb-3" style={{ color: colors.foreground }}>
                        Connection Health
                      </Text>
                      <View className="rounded-2xl p-4 gap-2" style={{ backgroundColor: colors.muted }}>
                        <View className="flex-row items-center gap-2">
                          <View
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stats.tierFit.fitCategory === 'mismatch' ? '#F59E0B' : '#10B981' }}
                          />
                          <Text className="text-base font-inter-semibold font-semibold" style={{ color: colors.foreground }}>
                            {stats.tierFit.fitCategory === 'mismatch' ? 'Needs Attention' : 'On Track'}
                          </Text>
                        </View>
                        <Text className="text-sm font-inter-regular leading-5" style={{ color: colors['muted-foreground'] }}>
                          Connecting every {Math.round(stats.tierFit.actualIntervalDays)} days
                          {'\n'}(Tier expects every {stats.tierFit.expectedIntervalDays} days)
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Stats Grid */}
                  <View className="px-5 py-3">
                    <Text className="text-base font-inter-bold font-bold mb-3" style={{ color: colors.foreground }}>
                      Quick Stats
                    </Text>
                    <View className="flex-row flex-wrap gap-3">
                      {/* Total Weaves */}
                      <View className="flex-1 min-w-[45%] rounded-2xl p-4 items-center gap-1.5" style={{ backgroundColor: colors.muted }}>
                        <Text className="text-4xl">🧵</Text>
                        <Text className="text-2xl font-inter-bold font-bold" style={{ color: colors.foreground }}>
                          {stats.totalWeaves}
                        </Text>
                        <Text className="text-xs font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                          Weaves Logged
                        </Text>
                      </View>

                      {/* Badges */}
                      <TouchableOpacity
                        className="flex-1 min-w-[45%] rounded-2xl p-4 items-center gap-1.5"
                        style={{ backgroundColor: colors.muted }}
                        onPress={() => setShowBadges(!showBadges)}
                        activeOpacity={0.7}
                      >
                        <Text className="text-4xl">🏆</Text>
                        <Text className="text-2xl font-inter-bold font-bold" style={{ color: colors.foreground }}>
                          {stats.badgeCount}
                        </Text>
                        <Text className="text-xs font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                          Badges Earned {stats.badgeCount > 0 ? '▼' : ''}
                        </Text>
                      </TouchableOpacity>

                      {/* Birthday */}
                      {stats.birthday && (
                        <View className="flex-1 min-w-[45%] rounded-2xl p-4 items-center gap-1.5" style={{ backgroundColor: colors.muted }}>
                          <Text className="text-4xl">🎂</Text>
                          <Text className="text-2xl font-inter-bold font-bold" style={{ color: colors.foreground }}>
                            {format(stats.birthday, 'MMM d')}
                          </Text>
                          <Text className="text-xs font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                            Birthday
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Favorite Weave Types */}
                  {stats.favoriteWeaveTypes.length > 0 && (
                    <View className="px-5 py-3">
                      <Text className="text-base font-inter-bold font-bold mb-3" style={{ color: colors.foreground }}>
                        Favorite Connection Styles
                      </Text>
                      <View className="gap-2.5">
                        {stats.favoriteWeaveTypes.map((category) => {
                          const metadata = CATEGORY_METADATA[category];
                          return (
                            <View
                              key={category}
                              className="flex-row rounded-xl p-3 gap-3 items-center"
                              style={{ backgroundColor: colors.muted }}
                            >
                              <Text className="text-3xl">{metadata.icon}</Text>
                              <View className="flex-1 gap-0.5">
                                <Text className="text-[15px] font-inter-semibold font-semibold" style={{ color: colors.foreground }}>
                                  {metadata.label}
                                </Text>
                                <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                                  {metadata.description}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Badges Section */}
                  {showBadges && stats.badges.length > 0 && (
                    <View className="px-5 py-3">
                      <Text className="text-base font-inter-bold font-bold mb-3" style={{ color: colors.foreground }}>
                        Relationship Badges
                      </Text>
                      <View className="gap-3">
                        {stats.badges.map((badge) => {
                          const rarityColor = getRarityColor(badge.rarity);
                          return (
                            <View
                              key={badge.id}
                              className="flex-row rounded-2xl p-4 gap-3"
                              style={{ backgroundColor: colors.muted }}
                            >
                              <View
                                className="w-14 h-14 rounded-full border-2 items-center justify-center"
                                style={{ borderColor: rarityColor }}
                              >
                                <Text className="text-3xl">{badge.icon}</Text>
                              </View>
                              <View className="flex-1 gap-1">
                                <Text className="text-base font-lora-bold font-bold" style={{ color: colors.foreground }}>
                                  {badge.name}
                                </Text>
                                <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                                  {badge.description}
                                </Text>
                                <Text
                                  className="text-[10px] font-inter-bold font-bold tracking-wider uppercase"
                                  style={{ color: rarityColor }}
                                >
                                  {badge.rarity.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* No weaves state */}
                  {stats.totalWeaves === 0 && (
                    <View className="p-10 items-center">
                      <Text className="text-6xl mb-4">🌱</Text>
                      <Text className="text-lg font-lora-bold font-bold mb-2" style={{ color: colors.foreground }}>
                        Start Your Journey
                      </Text>
                      <Text className="text-sm font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                        Log interactions with {friendName} to build your weave!
                      </Text>
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              className="mx-5 mt-3 rounded-xl py-3.5 items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-base font-inter-semibold font-semibold" style={{ color: colors['primary-foreground'] }}>
                Close
              </Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}
