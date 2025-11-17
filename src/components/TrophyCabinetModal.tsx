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
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '../db';
import UserProgress from '../db/models/UserProgress';
import {
  GLOBAL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  type GlobalAchievement,
} from '../lib/achievement-definitions';
import AchievementCard from './AchievementCard';

interface TrophyCabinetModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'global' | 'hidden';

export default function TrophyCabinetModal({ visible, onClose }: TrophyCabinetModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [unlockedGlobal, setUnlockedGlobal] = useState<string[]>([]);
  const [unlockedHidden, setUnlockedHidden] = useState<string[]>([]);
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
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            className="font-['Lora'] text-2xl font-bold mb-2"
            style={{ color: colors.foreground }}
          >
            Trophy Cabinet
          </Text>
          <View className="flex-row items-center justify-between">
            <Text
              className="font-['Inter'] text-3xl font-bold"
              style={{ color: colors.primary }}
            >
              {totalUnlocked}
            </Text>
            <Text
              className="font-['Inter'] text-base"
              style={{ color: colors['muted-foreground'] }}
            >
              / {totalAchievements} Unlocked
            </Text>
          </View>
          <View
            className="h-2 rounded-full mt-3 overflow-hidden"
            style={{ backgroundColor: colors.muted }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${(totalUnlocked / totalAchievements) * 100}%`,
                backgroundColor: colors.primary,
              }}
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
                <Text
                  className="font-['Inter'] text-lg font-bold"
                  style={{ color: colors.foreground }}
                >
                  {cat.label}
                </Text>
                <Text
                  className="font-['Inter'] text-sm"
                  style={{ color: colors['muted-foreground'] }}
                >
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

  function renderHiddenTab() {
    const unlockedHiddenAchievements = HIDDEN_ACHIEVEMENTS.filter(a =>
      unlockedHidden.includes(a.id)
    );

    return (
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            className="font-['Lora'] text-2xl font-bold mb-2"
            style={{ color: colors.foreground }}
          >
            🔮 Hidden Discoveries
          </Text>
          <Text
            className="font-['Inter'] text-base"
            style={{ color: colors['muted-foreground'] }}
          >
            {unlockedHiddenAchievements.length} / {HIDDEN_ACHIEVEMENTS.length} discovered
          </Text>
          <Text
            className="font-['Inter'] text-xs mt-2 italic"
            style={{ color: colors['muted-foreground'] }}
          >
            Secret achievements unlock through special actions
          </Text>
        </View>

        {/* Unlocked Hidden Achievements */}
        {unlockedHiddenAchievements.length > 0 && (
          <View className="mb-6">
            <Text
              className="font-['Inter'] text-base font-bold mb-3"
              style={{ color: colors.primary }}
            >
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
            <Text
              className="font-['Inter'] text-base font-bold mb-3"
              style={{ color: colors['muted-foreground'] }}
            >
              🔒 Undiscovered
            </Text>
            <View className="space-y-3">
              {HIDDEN_ACHIEVEMENTS.filter(a => !unlockedHidden.includes(a.id)).map(
                (achievement) => (
                  <View
                    key={achievement.id}
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: colors.muted,
                      borderWidth: 2,
                      borderColor: colors.border,
                    }}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-3xl mr-3 opacity-20">❓</Text>
                      <View className="flex-1">
                        <Text
                          className="font-['Lora'] font-bold text-lg"
                          style={{ color: colors['muted-foreground'] }}
                        >
                          ??? Hidden ???
                        </Text>
                        <Text
                          className="font-['Inter'] text-sm"
                          style={{ color: colors['muted-foreground'], opacity: 0.7 }}
                        >
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
          <View
            className="rounded-xl p-8 items-center mt-4"
            style={{
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text className="text-5xl mb-4">🔮</Text>
            <Text
              className="font-['Lora'] text-lg font-semibold mb-2 text-center"
              style={{ color: colors.foreground }}
            >
              Mysteries Await
            </Text>
            <Text
              className="font-['Inter'] text-sm text-center"
              style={{ color: colors['muted-foreground'] }}
            >
              Explore the app to discover hidden achievements!
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: colors.background }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-4 py-3"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            className="font-['Lora'] text-2xl font-bold"
            style={{ color: colors.foreground }}
          >
            Achievements
          </Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Text
              className="font-['Inter'] text-lg"
              style={{ color: colors['muted-foreground'] }}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View
          className="flex-row px-4"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('global')}
            className="flex-1 py-3 items-center"
            style={{
              borderBottomWidth: activeTab === 'global' ? 2 : 0,
              borderBottomColor: colors.primary,
            }}
          >
            <Text
              className="font-['Inter'] text-sm font-semibold"
              style={{
                color: activeTab === 'global' ? colors.primary : colors['muted-foreground'],
              }}
            >
              🏆 Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('hidden')}
            className="flex-1 py-3 items-center"
            style={{
              borderBottomWidth: activeTab === 'hidden' ? 2 : 0,
              borderBottomColor: colors.primary,
            }}
          >
            <Text
              className="font-['Inter'] text-sm font-semibold"
              style={{
                color: activeTab === 'hidden' ? colors.primary : colors['muted-foreground'],
              }}
            >
              🔮 Hidden
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View className="flex-1 pt-4">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Text
                className="font-['Inter'] text-sm"
                style={{ color: colors['muted-foreground'] }}
              >
                Loading...
              </Text>
            </View>
          ) : (
            <>
              {activeTab === 'global' && renderGlobalTab()}
              {activeTab === 'hidden' && renderHiddenTab()}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
