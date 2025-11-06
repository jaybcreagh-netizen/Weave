/**
 * TrophyCabinetModal Component
 *
 * Main achievement showcase modal
 * Opens from WeavingPracticeWidget streak section
 * Three tabs: Global Achievements, Friend Badges, Hidden Achievements
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { database } from '../db';
import UserProgress from '../db/models/UserProgress';
import FriendBadge from '../db/models/FriendBadge';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import {
  GLOBAL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  getAchievementById,
  type GlobalAchievement,
} from '../lib/achievement-definitions';
import {
  getBadgeById,
  WEAVE_COUNT_BADGES,
  DEPTH_BADGES,
  CONSISTENCY_BADGES,
  SPECIAL_BADGES,
  type BadgeDefinition,
} from '../lib/badge-definitions';
import AchievementCard from './AchievementCard';

interface TrophyCabinetModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'global' | 'badges' | 'hidden';

export default function TrophyCabinetModal({ visible, onClose }: TrophyCabinetModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [unlockedGlobal, setUnlockedGlobal] = useState<string[]>([]);
  const [unlockedHidden, setUnlockedHidden] = useState<string[]>([]);
  const [friendBadges, setFriendBadges] = useState<
    Array<{ badge: BadgeDefinition; friendName: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadAchievementData();
    }
  }, [visible]);

  async function loadAchievementData() {
    setLoading(true);

    // Load UserProgress
    const progressRecords = await database.get<UserProgress>('user_progress').query().fetch();
    if (progressRecords.length > 0) {
      const progress = progressRecords[0];
      setUserProgress(progress);
      setUnlockedGlobal(progress.globalAchievements || []);
      setUnlockedHidden(progress.hiddenAchievements || []);
    }

    // Load all friend badges with friend names
    const badges = await database
      .get<FriendBadge>('friend_badges')
      .query(Q.sortBy('unlocked_at', Q.desc))
      .fetch();

    const badgesWithNames = await Promise.all(
      badges.map(async (b) => {
        const friend = await database.get<Friend>('friends').find(b.friendId);
        const badgeDef = getBadgeById(b.badgeId);
        if (!badgeDef) return null;
        return {
          badge: badgeDef,
          friendName: friend.name,
        };
      })
    );

    setFriendBadges(
      badgesWithNames.filter((b): b is { badge: BadgeDefinition; friendName: string } => b !== null)
    );

    setLoading(false);
  }

  function renderGlobalTab() {
    const categories = [
      { key: 'weaving', label: '🧵 Weaving Mastery', achievements: GLOBAL_ACHIEVEMENTS.filter(a => a.category === 'weaving') },
      { key: 'consistency', label: '🔥 Consistency', achievements: GLOBAL_ACHIEVEMENTS.filter(a => a.category === 'consistency') },
      { key: 'depth', label: '🦉 Soulcraft', achievements: GLOBAL_ACHIEVEMENTS.filter(a => a.category === 'depth') },
      { key: 'social', label: '👥 Social Mastery', achievements: GLOBAL_ACHIEVEMENTS.filter(a => a.category === 'social') },
    ];

    const totalUnlocked = unlockedGlobal.length;
    const totalAchievements = GLOBAL_ACHIEVEMENTS.length;

    return (
      <ScrollView className="flex-1 px-4">
        {/* Header Stats */}
        <View className="bg-gradient-to-br from-emerald-900/40 to-blue-900/40 border border-emerald-700/50 rounded-2xl p-4 mb-4">
          <Text className="text-white font-['Lora'] text-2xl font-bold mb-2">
            Trophy Cabinet
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-emerald-400 font-['Inter'] text-3xl font-bold">
              {totalUnlocked}
            </Text>
            <Text className="text-gray-300 font-['Inter'] text-base">
              / {totalAchievements} Unlocked
            </Text>
          </View>
          <View className="h-2 bg-gray-800 rounded-full mt-3 overflow-hidden">
            <View
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
              style={{ width: `${(totalUnlocked / totalAchievements) * 100}%` }}
            />
          </View>
        </View>

        {/* Category Sections */}
        {categories.map((cat) => {
          const categoryUnlocked = cat.achievements.filter(a =>
            unlockedGlobal.includes(a.id)
          ).length;

          return (
            <View key={cat.key} className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-['Inter'] text-lg font-bold">
                  {cat.label}
                </Text>
                <Text className="text-gray-400 font-['Inter'] text-sm">
                  {categoryUnlocked} / {cat.achievements.length}
                </Text>
              </View>

              <View className="space-y-3">
                {cat.achievements.map((achievement) => {
                  const isUnlocked = unlockedGlobal.includes(achievement.id);
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      unlocked={isUnlocked}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  function renderBadgesTab() {
    // Group badges by friend
    const badgesByFriend = friendBadges.reduce((acc, item) => {
      if (!acc[item.friendName]) {
        acc[item.friendName] = [];
      }
      acc[item.friendName].push(item.badge);
      return acc;
    }, {} as Record<string, BadgeDefinition[]>);

    const friendNames = Object.keys(badgesByFriend).sort();

    return (
      <ScrollView className="flex-1 px-4">
        {/* Header Stats */}
        <View className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-700/50 rounded-2xl p-4 mb-4">
          <Text className="text-white font-['Lora'] text-2xl font-bold mb-2">
            Relationship Badges
          </Text>
          <Text className="text-gray-300 font-['Inter'] text-base">
            {friendBadges.length} badges earned across {friendNames.length} friends
          </Text>
        </View>

        {/* Badges by Friend */}
        {friendNames.length > 0 ? (
          friendNames.map((friendName) => (
            <View key={friendName} className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="bg-purple-500/20 rounded-full px-3 py-1">
                  <Text className="text-purple-400 font-['Inter'] text-sm font-bold">
                    {friendName}
                  </Text>
                </View>
                <Text className="text-gray-400 font-['Inter'] text-sm ml-2">
                  {badgesByFriend[friendName].length} badges
                </Text>
              </View>

              <View className="space-y-3">
                {badgesByFriend[friendName].map((badge) => (
                  <AchievementCard
                    key={badge.id}
                    achievement={badge}
                    unlocked={true}
                    compact={true}
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <View className="bg-gray-800/30 border border-gray-700 rounded-xl p-8 items-center">
            <Text className="text-5xl mb-4">🌱</Text>
            <Text className="text-white font-['Lora'] text-lg font-semibold mb-2 text-center">
              No Badges Yet
            </Text>
            <Text className="text-gray-400 font-['Inter'] text-sm text-center">
              Log interactions with your friends to start earning relationship badges!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderHiddenTab() {
    const unlockedHiddenAchievements = HIDDEN_ACHIEVEMENTS.filter(a =>
      unlockedHidden.includes(a.id)
    );

    return (
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View className="bg-gradient-to-br from-gray-900/60 to-purple-900/40 border border-purple-700/50 rounded-2xl p-4 mb-4">
          <Text className="text-white font-['Lora'] text-2xl font-bold mb-2">
            🔮 Hidden Discoveries
          </Text>
          <Text className="text-gray-300 font-['Inter'] text-base">
            {unlockedHiddenAchievements.length} / {HIDDEN_ACHIEVEMENTS.length} discovered
          </Text>
          <Text className="text-gray-400 font-['Inter'] text-xs mt-2 italic">
            Secret achievements unlock through special actions
          </Text>
        </View>

        {/* Unlocked Hidden Achievements */}
        {unlockedHiddenAchievements.length > 0 && (
          <View className="mb-6">
            <Text className="text-emerald-400 font-['Inter'] text-base font-bold mb-3">
              ✨ Discovered
            </Text>
            <View className="space-y-3">
              {unlockedHiddenAchievements.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={true}
                />
              ))}
            </View>
          </View>
        )}

        {/* Locked Hidden Achievements (show as mysterious) */}
        {HIDDEN_ACHIEVEMENTS.filter(a => !unlockedHidden.includes(a.id)).length > 0 && (
          <View className="mb-6">
            <Text className="text-gray-500 font-['Inter'] text-base font-bold mb-3">
              🔒 Undiscovered
            </Text>
            <View className="space-y-3">
              {HIDDEN_ACHIEVEMENTS.filter(a => !unlockedHidden.includes(a.id)).map(
                (achievement) => (
                  <View
                    key={achievement.id}
                    className="bg-gray-900/50 border-2 border-gray-700 rounded-2xl p-4"
                  >
                    <View className="flex-row items-center">
                      <Text className="text-3xl mr-3 opacity-20">❓</Text>
                      <View className="flex-1">
                        <Text className="text-gray-600 font-['Lora'] font-bold text-lg">
                          ??? Hidden ???
                        </Text>
                        <Text className="text-gray-700 font-['Inter'] text-sm">
                          Unlock this secret achievement to reveal its details...
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              )}
            </View>
          </View>
        )}

        {/* Empty State */}
        {unlockedHiddenAchievements.length === 0 && (
          <View className="bg-gray-800/30 border border-gray-700 rounded-xl p-8 items-center mt-4">
            <Text className="text-5xl mb-4">🔮</Text>
            <Text className="text-white font-['Lora'] text-lg font-semibold mb-2 text-center">
              Mysteries Await
            </Text>
            <Text className="text-gray-400 font-['Inter'] text-sm text-center">
              Explore the app to discover hidden achievements!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-gray-950">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800">
          <Text className="text-white font-['Lora'] text-2xl font-bold">
            Achievements
          </Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Text className="text-gray-400 font-['Inter'] text-lg">✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row border-b border-gray-800 px-4">
          <TouchableOpacity
            onPress={() => setActiveTab('global')}
            className={`flex-1 py-3 items-center ${
              activeTab === 'global' ? 'border-b-2 border-emerald-500' : ''
            }`}
          >
            <Text
              className={`font-['Inter'] text-sm font-semibold ${
                activeTab === 'global' ? 'text-emerald-400' : 'text-gray-500'
              }`}
            >
              🏆 Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('badges')}
            className={`flex-1 py-3 items-center ${
              activeTab === 'badges' ? 'border-b-2 border-purple-500' : ''
            }`}
          >
            <Text
              className={`font-['Inter'] text-sm font-semibold ${
                activeTab === 'badges' ? 'text-purple-400' : 'text-gray-500'
              }`}
            >
              🌟 Badges
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('hidden')}
            className={`flex-1 py-3 items-center ${
              activeTab === 'hidden' ? 'border-b-2 border-purple-500' : ''
            }`}
          >
            <Text
              className={`font-['Inter'] text-sm font-semibold ${
                activeTab === 'hidden' ? 'text-purple-400' : 'text-gray-500'
              }`}
            >
              🔮 Hidden
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View className="flex-1 pt-4">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-400 font-['Inter'] text-sm">Loading...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'global' && renderGlobalTab()}
              {activeTab === 'badges' && renderBadgesTab()}
              {activeTab === 'hidden' && renderHiddenTab()}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
