/**
 * YearInMoonsWidget
 * Home screen widget showing current month moon calendar and stats
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Moon, TrendingUp, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { MoonPhaseIllustration } from '@/components/YearInMoons/MoonPhaseIllustration';
import { YearInMoonsModal } from '@/components/YearInMoons/YearInMoonsModal';
import { ReflectionJourneyModal } from '@/components/ReflectionJourney/ReflectionJourneyModal';
import {
  getYearMoonData,
  getYearStats,
  getMonthName,
  MonthMoonData,
} from '@/modules/reflection';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'year-in-moons',
  type: 'year-in-moons',
  title: '🌙 Year in Moons',
  minHeight: 240,
  fullWidth: true,
};

export const YearInMoonsWidget: React.FC = () => {
  const { colors } = useTheme();
  const [currentMonthData, setCurrentMonthData] = useState<MonthMoonData | null>(null);
  const [yearStats, setYearStats] = useState({
    totalCheckins: 0,
    avgBattery: 0,
    mostCommonLevel: 0,
    streakDays: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const moonSize = Math.floor((screenWidth - 120) / 7); // 7 moons per row with padding

  useEffect(() => {
    loadMonthData();

    // Subscribe to changes in the social_battery_logs table
    const subscription = database.get('social_battery_logs')
      .query()
      .observe()
      .subscribe(() => {
        loadMonthData();
      });

    return () => subscription.unsubscribe();
  }, []);

  const loadMonthData = async () => {
    // Don't set loading to true on updates to avoid flash
    if (!currentMonthData) setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const [yearData, stats] = await Promise.all([
        getYearMoonData(currentYear),
        getYearStats(currentYear),
      ]);

      setCurrentMonthData(yearData[currentMonth]);
      setYearStats(stats);
    } catch (error) {
      console.error('Error loading month data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !currentMonthData) {
    return (
      <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
        <View />
      </HomeWidgetBase>
    );
  }

  const currentMonthName = getMonthName(currentMonthData.month);

  // Calculate which days to show (dynamic 2-week window)
  const today = new Date();
  const todayDate = today.getDate();
  const firstDayOfMonth = currentMonthData.days[0].date;
  const padding = firstDayOfMonth.getDay();

  // Find the row index for today
  // (todayDate + padding - 1) gives the 0-indexed cell position
  const todayCellIndex = todayDate + padding - 1;
  const todayRowIndex = Math.floor(todayCellIndex / 7);

  // We want to show 2 rows (14 days). 
  // If today is in the first row, show rows 0 and 1.
  // Otherwise, show the row before today and today's row (context + current).
  const startRowIndex = todayRowIndex === 0 ? 0 : todayRowIndex - 1;

  // Calculate start and end indices for the days array
  // Each row is 7 cells. 
  const startCellIndex = startRowIndex * 7;
  const endCellIndex = startCellIndex + 14;

  // Convert cell indices back to day indices (subtract padding)
  const startDayIndex = Math.max(0, startCellIndex - padding);
  const endDayIndex = Math.min(currentMonthData.days.length, endCellIndex - padding);

  const visibleDays = currentMonthData.days.slice(startDayIndex, endDayIndex);

  // Calculate padding for the first visible row
  // If we start at row 0, use original padding.
  // If we start at any other row, it starts on a Sunday, so padding is 0.
  const visiblePadding = startRowIndex === 0 ? padding : 0;

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.9}>
        <HomeWidgetBase config={WIDGET_CONFIG} isLoading={false}>
          <View className="p-5">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {currentMonthName} {currentMonthData.year}
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Your energy in moon phases
                </Text>
              </View>

              <View
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: colors.muted }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  Tap to expand
                </Text>
              </View>
            </View>

            {/* Stats Row */}
            <View className="flex-row gap-2 mb-4">
              <View className="flex-1 p-2.5 rounded-xl" style={{ backgroundColor: colors.muted }}>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {yearStats.totalCheckins}
                </Text>
                <Text
                  className="text-[9px]"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Check-ins
                </Text>
              </View>

              <View className="flex-1 p-2.5 rounded-xl" style={{ backgroundColor: colors.muted }}>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {yearStats.avgBattery}/5
                </Text>
                <Text
                  className="text-[9px]"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Avg Energy
                </Text>
              </View>
            </View>

            {/* Week Day Labels */}
            <View className="flex-row mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <View
                  key={i}
                  style={{ width: moonSize }}
                  className="items-center"
                >
                  <Text
                    className="text-[9px]"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Moon Grid - Dynamic 2 Weeks */}
            <View className="flex-row flex-wrap">
              {/* Padding for first visible day */}
              {Array.from({ length: visiblePadding }).map((_, i) => (
                <View key={`pad-${i}`} style={{ width: moonSize, height: moonSize }} />
              ))}

              {visibleDays.map((day, index) => (
                <View
                  key={day.date.toISOString()}
                  className="items-center justify-center mb-1"
                  style={{ width: moonSize, height: moonSize }}
                >
                  <MoonPhaseIllustration
                    phase={day.moonPhase}
                    size={moonSize - 8}
                    hasCheckin={day.hasCheckin}
                  />
                  <Text
                    className="text-[8px] mt-0.5"
                    style={{
                      color: day.hasCheckin ? colors.foreground : colors['muted-foreground'],
                      fontFamily: 'Inter_400Regular',
                      opacity: day.hasCheckin ? 1 : 0.5,
                    }}
                  >
                    {day.date.getDate()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setShowJournal(true);
                }}
                className="flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center gap-1.5"
                style={{ backgroundColor: colors.primary }}
                activeOpacity={0.7}
              >
                <BookOpen size={16} color={colors['primary-foreground']} />
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                >
                  Journal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setShowModal(true);
                }}
                className="flex-1 py-2 px-3 rounded-lg flex-row items-center justify-center gap-1.5"
                style={{ backgroundColor: colors.muted }}
                activeOpacity={0.7}
              >
                <Moon size={16} color={colors.foreground} />
                <Text
                  className="text-xs font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  Full Year
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </HomeWidgetBase>
      </TouchableOpacity>

      <YearInMoonsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />

      <ReflectionJourneyModal
        isOpen={showJournal}
        onClose={() => setShowJournal(false)}
      />
    </>
  );
};
