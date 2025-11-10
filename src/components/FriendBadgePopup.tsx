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
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { database } from '../db';
import FriendBadge from '../db/models/FriendBadge';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { getBadgeById } from '../lib/badge-definitions';
import { analyzeInteractionPattern } from '../lib/pattern-analyzer';
import { archetypeData } from '../lib/constants';
import { CATEGORY_METADATA } from '../lib/interaction-categories';
import { useTheme } from '../hooks/useTheme';
import type { Archetype, InteractionCategory } from '../components/types';

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
}

export default function FriendBadgePopup({
  visible,
  onClose,
  friendId,
  friendName,
}: FriendBadgePopupProps) {
  const [stats, setStats] = useState<FriendStats | null>(null);
  const [loading, setLoading] = useState(true);
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
      // Load friend data
      const friend = await database.get<Friend>('friends').find(friendId);

      // Load interactions for pattern analysis
      const interactionFriends = await database
        .get('interaction_friends')
        .query(Q.where('friend_id', friendId))
        .fetch();

      const interactionIds = interactionFriends.map(
        (if_: any) => if_.interactionId
      );

      const interactions = await database
        .get('interactions')
        .query(Q.where('id', Q.oneOf(interactionIds)))
        .fetch();

      // Analyze pattern to get favorite weave types
      const pattern = analyzeInteractionPattern(
        interactions.map((i: any) => ({
          id: i.id,
          interactionDate: new Date(i.interactionDate),
          status: i.status,
          category: i.category,
        }))
      );

      // Load badges count
      const badges = await database
        .get<FriendBadge>('friend_badges')
        .query(Q.where('friend_id', friendId))
        .fetch();

      setStats({
        archetype: friend.archetype as Archetype,
        totalWeaves: interactions.length,
        birthday: friend.birthday ? new Date(friend.birthday) : undefined,
        favoriteWeaveTypes: pattern.preferredCategories,
        badgeCount: badges.length,
      });
    } catch (error) {
      console.error('Error loading friend stats:', error);
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

  if (!stats && !loading) return null;

  const archetypeInfo = stats ? archetypeData[stats.archetype] : null;

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
          <BlurView
            intensity={95}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            {/* Handle Bar */}
            <View
              style={[
                styles.handleBar,
                { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)' }
              ]}
            />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.friendName, { color: colors.foreground }]}>
                  {friendName}
                </Text>
                <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
                  Friend Overview
                </Text>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.loadingText, { color: colors['muted-foreground'] }]}>
                    Loading...
                  </Text>
                </View>
              ) : stats ? (
                <>
                  {/* Archetype Section */}
                  {archetypeInfo && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        Archetype
                      </Text>
                      <View style={[styles.archetypeCard, { backgroundColor: colors.muted }]}>
                        <Text style={styles.archetypeIcon}>{archetypeInfo.icon}</Text>
                        <View style={styles.archetypeInfo}>
                          <Text style={[styles.archetypeName, { color: colors.foreground }]}>
                            {archetypeInfo.name}
                          </Text>
                          <Text style={[styles.archetypeEssence, { color: colors['muted-foreground'] }]}>
                            {archetypeInfo.essence}
                          </Text>
                          <Text style={[styles.archetypeCare, { color: colors['muted-foreground'] }]}>
                            {archetypeInfo.careStyle}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Stats Grid */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Quick Stats
                    </Text>
                    <View style={styles.statsGrid}>
                      {/* Total Weaves */}
                      <View style={[styles.statCard, { backgroundColor: colors.muted }]}>
                        <Text style={styles.statIcon}>🧵</Text>
                        <Text style={[styles.statValue, { color: colors.foreground }]}>
                          {stats.totalWeaves}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
                          Weaves Logged
                        </Text>
                      </View>

                      {/* Badges */}
                      <View style={[styles.statCard, { backgroundColor: colors.muted }]}>
                        <Text style={styles.statIcon}>🏆</Text>
                        <Text style={[styles.statValue, { color: colors.foreground }]}>
                          {stats.badgeCount}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
                          Badges Earned
                        </Text>
                      </View>

                      {/* Birthday */}
                      {stats.birthday && (
                        <View style={[styles.statCard, { backgroundColor: colors.muted }]}>
                          <Text style={styles.statIcon}>🎂</Text>
                          <Text style={[styles.statValue, { color: colors.foreground }]}>
                            {format(stats.birthday, 'MMM d')}
                          </Text>
                          <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
                            Birthday
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Favorite Weave Types */}
                  {stats.favoriteWeaveTypes.length > 0 && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        Favorite Connection Styles
                      </Text>
                      <View style={styles.favoritesList}>
                        {stats.favoriteWeaveTypes.map((category) => {
                          const metadata = CATEGORY_METADATA[category];
                          return (
                            <View
                              key={category}
                              style={[styles.favoriteCard, { backgroundColor: colors.muted }]}
                            >
                              <Text style={styles.favoriteIcon}>{metadata.icon}</Text>
                              <View style={styles.favoriteInfo}>
                                <Text style={[styles.favoriteLabel, { color: colors.foreground }]}>
                                  {metadata.label}
                                </Text>
                                <Text style={[styles.favoriteDescription, { color: colors['muted-foreground'] }]}>
                                  {metadata.description}
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
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyEmoji}>🌱</Text>
                      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                        Start Your Journey
                      </Text>
                      <Text style={[styles.emptyText, { color: colors['muted-foreground'] }]}>
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
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.closeButtonText, { color: colors['primary-foreground'] }]}>
                Close
              </Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    paddingBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
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
  },
  headerTextContainer: {
    flex: 1,
  },
  friendName: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
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
    fontFamily: 'Inter_400Regular',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  archetypeCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  archetypeIcon: {
    fontSize: 48,
  },
  archetypeInfo: {
    flex: 1,
    gap: 4,
  },
  archetypeName: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  archetypeEssence: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  archetypeCare: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    fontSize: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  favoritesList: {
    gap: 10,
  },
  favoriteCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 28,
  },
  favoriteInfo: {
    flex: 1,
    gap: 2,
  },
  favoriteLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  favoriteDescription: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
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
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
