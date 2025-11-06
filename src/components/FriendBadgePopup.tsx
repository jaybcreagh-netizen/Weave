/**
 * FriendBadgePopup Component
 *
 * Beautiful native-feeling popup that shows relationship badges for a specific friend
 * Triggered by long-press on friend card
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { database } from '../db';
import FriendBadge from '../db/models/FriendBadge';
import { Q } from '@nozbe/watermelondb';
import {
  getBadgeById,
  type BadgeDefinition,
} from '../lib/badge-definitions';
import { calculateFriendBadgeProgress, type BadgeProgress } from '../lib/badge-calculator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FriendBadgePopupProps {
  visible: boolean;
  onClose: () => void;
  friendId: string;
  friendName: string;
}

export default function FriendBadgePopup({
  visible,
  onClose,
  friendId,
  friendName,
}: FriendBadgePopupProps) {
  const [unlockedBadges, setUnlockedBadges] = useState<BadgeDefinition[]>([]);
  const [progressData, setProgressData] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      loadBadgeData();
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

  async function loadBadgeData() {
    setLoading(true);

    try {
      // Load unlocked badges
      const badges = await database
        .get<FriendBadge>('friend_badges')
        .query(Q.where('friend_id', friendId), Q.sortBy('unlocked_at', Q.desc))
        .fetch();

      const unlockedDefs = badges
        .map(b => getBadgeById(b.badgeId))
        .filter((b): b is BadgeDefinition => b !== null);

      setUnlockedBadges(unlockedDefs);

      // Calculate progress
      const progress = await calculateFriendBadgeProgress(friendId);
      setProgressData(progress);
    } catch (error) {
      console.error('Error loading badge data:', error);
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

  const categoryLabels = {
    weave_count: '🌱 Connection Milestones',
    depth: '📚 Reflection Depth',
    consistency: '🔥 Consistency Streak',
    special: '✨ Special Moments',
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Content Card */}
        <Animated.View style={[styles.contentContainer, containerStyle]}>
          <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.friendName}>{friendName}</Text>
                <Text style={styles.subtitle}>Relationship Badges</Text>
              </View>
              {!loading && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{unlockedBadges.length}</Text>
                </View>
              )}
            </View>

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading badges...</Text>
                </View>
              ) : (
                <>
                  {/* Summary Grid */}
                  <View style={styles.summaryGrid}>
                    {progressData.slice(0, 4).map((cat) => {
                      const emoji = categoryLabels[cat.categoryType as keyof typeof categoryLabels]?.split(' ')[0] || '🏆';
                      return (
                        <View key={cat.categoryType} style={styles.summaryCard}>
                          <Text style={styles.summaryEmoji}>{emoji}</Text>
                          <Text style={styles.summaryTier}>Tier {cat.currentTier}</Text>
                          {cat.nextBadge && (
                            <Text style={styles.summaryProgress}>
                              {Math.round(cat.progressPercent)}%
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Unlocked Badges */}
                  {unlockedBadges.length > 0 ? (
                    <View style={styles.badgesSection}>
                      <Text style={styles.sectionTitle}>Earned Badges</Text>
                      {unlockedBadges.map((badge) => (
                        <View key={badge.id} style={styles.badgeCard}>
                          <View
                            style={[
                              styles.badgeIconContainer,
                              { borderColor: getRarityColor(badge.rarity) },
                            ]}
                          >
                            <Text style={styles.badgeIcon}>{badge.icon}</Text>
                          </View>
                          <View style={styles.badgeInfo}>
                            <Text style={styles.badgeName}>{badge.name}</Text>
                            <Text style={styles.badgeDescription}>
                              {badge.description}
                            </Text>
                            <Text
                              style={[
                                styles.badgeRarity,
                                { color: getRarityColor(badge.rarity) },
                              ]}
                            >
                              {badge.rarity.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyEmoji}>🌱</Text>
                      <Text style={styles.emptyTitle}>Start Your Journey</Text>
                      <Text style={styles.emptyText}>
                        Log interactions with {friendName} to earn badges!
                      </Text>
                    </View>
                  )}

                  {/* Next Milestones */}
                  {progressData.some(p => p.nextBadge) && (
                    <View style={styles.milestonesSection}>
                      <Text style={styles.sectionTitle}>Next Milestones</Text>
                      {progressData
                        .filter(p => p.nextBadge)
                        .map((cat) => (
                          <View key={cat.categoryType} style={styles.milestoneCard}>
                            <View style={styles.milestoneHeader}>
                              <Text style={styles.milestoneName}>
                                {cat.nextBadge!.name}
                              </Text>
                              <Text style={styles.milestonePercent}>
                                {Math.round(cat.progressPercent)}%
                              </Text>
                            </View>
                            <View style={styles.progressBarContainer}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  {
                                    width: `${Math.min(100, cat.progressPercent)}%`,
                                    backgroundColor: getRarityColor(cat.nextBadge!.rarity),
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.milestoneProgress}>
                              {cat.progress} / {cat.nextBadge!.threshold}
                            </Text>
                          </View>
                        ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  contentContainer: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  blurContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextContainer: {
    flex: 1,
  },
  friendName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  badgeCount: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    fontFamily: 'Inter_700Bold',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter_400Regular',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  summaryTier: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  summaryProgress: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  badgesSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Inter_700Bold',
    marginBottom: 16,
  },
  badgeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  badgeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Lora_700Bold',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  badgeRarity: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  milestonesSection: {
    padding: 20,
    paddingTop: 0,
  },
  milestoneCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  milestonePercent: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Inter_700Bold',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  milestoneProgress: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter_400Regular',
  },
});
