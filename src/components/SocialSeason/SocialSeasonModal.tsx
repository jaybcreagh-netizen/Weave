/**
 * SocialSeasonModal
 * Full network health hub with tabs: Pulse, Health, Insights
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Activity, BarChart3 } from 'lucide-react-native';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '../../hooks/useTheme';
import { type SocialSeason, type SeasonExplanationData } from '../../lib/social-season/season-types';
import { SEASON_STYLES, getSeasonDisplayName } from '../../lib/social-season/season-content';
import { generateSeasonExplanation } from '../../lib/narrative-generator';
import { GraphsTabContent } from '../YearInMoons/GraphsTabContent';
import { database } from '../../db';
import Interaction from '../../db/models/Interaction';
import WeeklyReflection from '../../db/models/WeeklyReflection';
import { useUserProfileStore } from '../../stores/userProfileStore';

interface SocialSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: SocialSeason;
  seasonData: SeasonExplanationData | null;
  weeklyWeaves: number;
  currentStreak: number;
  networkHealth: number;
}

type Tab = 'pulse' | 'insights';

export function SocialSeasonModal({
  isOpen,
  onClose,
  season,
  seasonData,
  weeklyWeaves,
  currentStreak,
  networkHealth,
}: SocialSeasonModalProps) {
  const { colors, isDarkMode } = useTheme();
  const [currentTab, setCurrentTab] = useState<Tab>('pulse');

  const seasonStyle = SEASON_STYLES[season];
  const gradientColors = isDarkMode ? seasonStyle.gradientColorsDark : seasonStyle.gradientColorsLight;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'pulse', label: 'Pulse', icon: Activity },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
  ];

  const handleTabChange = (tab: Tab) => {
    setCurrentTab(tab);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={isDarkMode ? ['#1a1d2e', '#0f1419'] : ['#FAF1E0', '#F3EAD8']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#2A2E3F' : '#E0E3E9' }}
          >
            <View className="flex-1">
              <Text
                className="text-xl font-bold"
                style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
              >
                {getSeasonDisplayName(season)}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
              >
                Network Health & Insights
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
              <X size={24} color={isDarkMode ? '#8A8F9E' : '#6C7589'} />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row px-5 py-3 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                  className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: isActive ? (isDarkMode ? '#2A2E3F' : '#FFF8ED') : 'transparent',
                  }}
                >
                  <Icon size={16} color={isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589')} />
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589'),
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1 px-5 py-4"
            showsVerticalScrollIndicator={false}
          >
            {currentTab === 'pulse' && (
              <PulseTabContent
                season={season}
                seasonData={seasonData}
                weeklyWeaves={weeklyWeaves}
                currentStreak={currentStreak}
                isDarkMode={isDarkMode}
              />
            )}

            {currentTab === 'insights' && (
              <InsightsTabContent isDarkMode={isDarkMode} />
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// ============================================
// PULSE TAB
// ============================================
function PulseTabContent({
  season,
  seasonData,
  weeklyWeaves,
  currentStreak,
  isDarkMode,
}: {
  season: SocialSeason;
  seasonData: SeasonExplanationData | null;
  weeklyWeaves: number;
  currentStreak: number;
  isDarkMode: boolean;
}) {
  const explanation = seasonData ? generateSeasonExplanation(seasonData) : null;
  const [monthlyActivity, setMonthlyActivity] = useState<Map<string, boolean>>(new Map());
  const [monthlyWeaves, setMonthlyWeaves] = useState(0);
  const [longestStreak, setLongestStreak] = useState({ count: 0, startDate: '', endDate: '' });
  const [avgWeeklyWeaves, setAvgWeeklyWeaves] = useState(0);
  const { profile } = useUserProfileStore();

  const seasonStyle = SEASON_STYLES[season];
  const gradientColors = isDarkMode ? seasonStyle.gradientColorsDark : seasonStyle.gradientColorsLight;

  useEffect(() => {
    loadMonthlyStats();
  }, []);

  const loadMonthlyStats = async () => {
    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // Get all interactions in the current month
      const monthlyInteractions = await database
        .get<Interaction>('interactions')
        .query(
          Q.where('status', 'completed'),
          Q.where('interaction_date', Q.gte(monthStart.getTime())),
          Q.where('interaction_date', Q.lte(monthEnd.getTime()))
        )
        .fetch();

      setMonthlyWeaves(monthlyInteractions.length);

      // Build activity map for calendar
      const activityMap = new Map<string, boolean>();
      monthlyInteractions.forEach(interaction => {
        const dateKey = format(interaction.interactionDate, 'yyyy-MM-dd');
        activityMap.set(dateKey, true);
      });

      // Also check for battery check-ins and journal entries
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      for (const day of days) {
        const dayStart = day.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const dateKey = format(day, 'yyyy-MM-dd');

        if (!activityMap.has(dateKey)) {
          const [batteryCheckins, journalEntries] = await Promise.all([
            profile?.socialBatteryHistory?.filter(
              entry => entry.timestamp >= dayStart && entry.timestamp < dayEnd
            ).length || 0,
            database
              .get<WeeklyReflection>('weekly_reflections')
              .query(
                Q.where('created_at', Q.gte(dayStart)),
                Q.where('created_at', Q.lt(dayEnd))
              )
              .fetchCount(),
          ]);

          if (batteryCheckins > 0 || journalEntries > 0) {
            activityMap.set(dateKey, true);
          }
        }
      }

      setMonthlyActivity(activityMap);

      // Calculate longest streak ever
      const allInteractions = await database
        .get<Interaction>('interactions')
        .query(Q.where('status', 'completed'), Q.sortBy('interaction_date', Q.desc))
        .fetch();

      let maxStreak = 0;
      let currentStreakCount = 0;
      let streakStart = '';
      let streakEnd = '';
      let maxStreakStart = '';
      let maxStreakEnd = '';

      const sortedDates = allInteractions
        .map(i => format(i.interactionDate, 'yyyy-MM-dd'))
        .filter((v, i, a) => a.indexOf(v) === i) // unique dates
        .sort()
        .reverse();

      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          currentStreakCount = 1;
          streakStart = sortedDates[i];
          streakEnd = sortedDates[i];
        } else {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const daysDiff = differenceInDays(prevDate, currDate);

          if (daysDiff === 1) {
            currentStreakCount++;
            streakStart = sortedDates[i];
          } else {
            if (currentStreakCount > maxStreak) {
              maxStreak = currentStreakCount;
              maxStreakStart = streakStart;
              maxStreakEnd = streakEnd;
            }
            currentStreakCount = 1;
            streakStart = sortedDates[i];
            streakEnd = sortedDates[i];
          }
        }
      }

      if (currentStreakCount > maxStreak) {
        maxStreak = currentStreakCount;
        maxStreakStart = streakStart;
        maxStreakEnd = streakEnd;
      }

      setLongestStreak({
        count: maxStreak,
        startDate: maxStreakStart,
        endDate: maxStreakEnd,
      });

      // Calculate average weekly weaves (last 4 weeks)
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const recentInteractions = await database
        .get<Interaction>('interactions')
        .query(
          Q.where('status', 'completed'),
          Q.where('interaction_date', Q.gte(fourWeeksAgo.getTime()))
        )
        .fetchCount();

      setAvgWeeklyWeaves(Math.round((recentInteractions / 4) * 10) / 10);
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    }
  };

  // Generate calendar grid
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <View className="gap-6">
      {/* Season Explanation */}
      {explanation && (
        <View
          className="p-5 rounded-2xl"
          style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
        >
          <Text
            className="text-lg font-bold mb-3"
            style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
          >
            {explanation.headline}
          </Text>

          {explanation.reasons.length > 0 && (
            <View className="mb-4">
              <Text
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_600SemiBold' }}
              >
                Based on:
              </Text>
              {explanation.reasons.map((reason, index) => (
                <View key={index} className="flex-row items-start gap-2 mb-1">
                  <Text
                    className="text-base"
                    style={{ color: isDarkMode ? '#A78BFA' : '#8B5CF6', fontFamily: 'Inter_600SemiBold' }}
                  >
                    •
                  </Text>
                  <Text
                    className="text-sm flex-1"
                    style={{ color: isDarkMode ? '#C5CAD3' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                  >
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View
            className="p-3 rounded-xl"
            style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}
          >
            <Text
              className="text-sm leading-5"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_400Regular' }}
            >
              {explanation.insight}
            </Text>
          </View>
        </View>
      )}

      {/* Streak Calendar */}
      <View
        className="p-5 rounded-2xl"
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          {format(today, 'MMMM yyyy')}
        </Text>

        {/* Weekday headers */}
        <View className="flex-row mb-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <View key={index} style={calendarStyles.dayHeader}>
              <Text
                style={[
                  calendarStyles.dayHeaderText,
                  { color: isDarkMode ? '#8A8F9E' : '#6C7589' }
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={calendarStyles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const hasActivity = monthlyActivity.get(dateKey) || false;
            const isToday = isSameDay(day, today);
            const isCurrentMonth = day.getMonth() === today.getMonth();

            return (
              <View
                key={index}
                style={[
                  calendarStyles.dayCell,
                  isToday && calendarStyles.todayCell,
                ]}
              >
                {hasActivity ? (
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      calendarStyles.activityDot,
                      isToday && calendarStyles.todayDot,
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      calendarStyles.emptyDot,
                      { borderColor: isDarkMode ? '#3A3E4F' : '#E0E3E9' },
                      !isCurrentMonth && calendarStyles.otherMonthDot,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* This Week Stats */}
      <View
        className="p-5 rounded-2xl"
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          This Week
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {weeklyWeaves}
            </Text>
            <Text
              className="text-xs"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Weaves
            </Text>
          </View>

          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
            <Text
              className="text-2xl font-bold mb-1"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {currentStreak}
            </Text>
            <Text
              className="text-xs"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Day Streak
            </Text>
          </View>
        </View>
      </View>

      {/* Additional Stats */}
      <View
        className="p-5 rounded-2xl"
        style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
      >
        <Text
          className="text-lg font-bold mb-4"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          All Time
        </Text>

        <View className="gap-3">
          <View className="flex-row items-center justify-between p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
            <Text
              className="text-sm"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              This month
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {monthlyWeaves} {monthlyWeaves === 1 ? 'weave' : 'weaves'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
            <Text
              className="text-sm"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Longest streak
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {longestStreak.count} {longestStreak.count === 1 ? 'day' : 'days'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#FFF8ED' }}>
            <Text
              className="text-sm"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Avg per week
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {avgWeeklyWeaves} weaves
            </Text>
          </View>
        </View>
      </View>

      {/* Spacer */}
      <View className="h-8" />
    </View>
  );
}

// ============================================
// INSIGHTS TAB
// ============================================
function InsightsTabContent({ isDarkMode }: { isDarkMode: boolean }) {
  return <GraphsTabContent />;
}

// ============================================
// CALENDAR STYLES
// ============================================
const calendarStyles = StyleSheet.create({
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  dayHeaderText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 7 days per week
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  todayCell: {
    // Special styling for today if needed
  },
  activityDot: {
    width: '80%',
    height: '80%',
    borderRadius: 999,
  },
  todayDot: {
    width: '90%',
    height: '90%',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyDot: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  otherMonthDot: {
    opacity: 0.3,
  },
});
