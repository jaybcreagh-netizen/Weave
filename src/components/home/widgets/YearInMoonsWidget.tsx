/**
 * YearInMoonsWidget
 * Home screen widget showing current month moon calendar and stats
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Moon, BookOpen } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

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
import SocialBatteryLog from '@/db/models/SocialBatteryLog';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'year-in-moons',
  type: 'year-in-moons',
  title: '🌙 Year in Moons',
  minHeight: 240,
  fullWidth: true,
};

// --- Inner Component (Receives Data) ---

interface YearInMoonsWidgetContentProps {
  logs: SocialBatteryLog[];
}

const YearInMoonsWidgetContent: React.FC<YearInMoonsWidgetContentProps> = ({ logs }) => {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [showJournal, setShowJournal] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const moonSize = Math.floor((screenWidth - 120) / 7); // 7 moons per row with padding

  // Process data synchronously when logs change
  // This is fast enough for < 365 items
  const { yearStats } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // We need to reconstruct the "year data" structure from the raw logs
    // Ideally, we'd refactor getYearMoonData to accept logs, but for now we can rely on the fact
    // that getYearMoonData fetches from DB.
    // HOWEVER, since we want reactivity, we should process the passed `logs` prop.

    // For this widget, we primarily need the stats and the current month's days.
    // Let's use the existing helper but we might need to trigger a re-calc.
    // Actually, since we have the logs, let's just calculate what we need for the UI.

    // 1. Calculate Stats
    const totalCheckins = logs.length;
    const avgBattery = logs.length > 0
      ? (logs.reduce((acc, log) => acc + log.value, 0) / logs.length).toFixed(1)
      : '0.0';

    // 2. Build Current Month Data
    // We can reuse the structure from getYearMoonData but populate it with our reactive logs
    // This is a bit complex to duplicate logic, so for now, let's use a hybrid approach:
    // We use the logs to trigger the effect, but we still might need the moon phase data.
    // A better approach for the "Moon Phase" part is to use the helper which calculates phases.

    // Let's use the helper synchronously if possible, or just re-run it.
    // getYearMoonData is async because it fetches. We need a synchronous version or 
    // we can just accept that we might need to fetch moon phases.

    // WAIT: The moon phases are static math. The "checkin" status is what comes from DB.
    // Let's use the existing async helper but trigger it when `logs` changes.
    // This is a slight compromise but better than rewriting the whole moon phase logic here.

    return {
      // placeholders until effect runs
      currentMonthData: null as MonthMoonData | null,
      yearStats: {
        totalCheckins,
        avgBattery,
        mostCommonLevel: 0,
        streakDays: 0
      }
    };
  }, [logs]);

  // We still need the moon phase data which is complex to calculate.
  // Let's use a local state that updates when `logs` changes.
  const [asyncData, setAsyncData] = useState<{
    monthData: MonthMoonData | null;
    stats: any;
  }>({ monthData: null, stats: null });

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      // These helpers fetch from DB internally. 
      // Since we are observing the DB in the parent, these fetches will return fresh data.
      // It's not 100% pure "props down" but it ensures reactivity because this effect runs whenever `logs` changes.
      const [yearData, stats] = await Promise.all([
        getYearMoonData(currentYear),
        getYearStats(currentYear),
      ]);

      if (mounted) {
        setAsyncData({
          monthData: yearData[currentMonth],
          stats: stats
        });
      }
    };
    load();
    return () => { mounted = false; };
  }, [logs]); // Re-run when logs change!

  if (!asyncData.monthData) {
    return (
      <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
        <View />
      </HomeWidgetBase>
    );
  }

  const currentMonthData = asyncData.monthData;
  const currentStats = yearStats;
  const currentMonthName = getMonthName(currentMonthData.month);

  // Calculate which days to show (dynamic 2-week window)
  const today = new Date();
  const todayDate = today.getDate();
  const firstDayOfMonth = currentMonthData.days[0].date;
  const padding = firstDayOfMonth.getDay();

  // Find the row index for today
  const todayCellIndex = todayDate + padding - 1;
  const todayRowIndex = Math.floor(todayCellIndex / 7);

  // We want to show 2 rows (14 days). 
  const startRowIndex = todayRowIndex === 0 ? 0 : todayRowIndex - 1;

  // Calculate start and end indices for the days array
  const startCellIndex = startRowIndex * 7;
  const endCellIndex = startCellIndex + 14;

  // Convert cell indices back to day indices (subtract padding)
  const startDayIndex = Math.max(0, startCellIndex - padding);
  const endDayIndex = Math.min(currentMonthData.days.length, endCellIndex - padding);

  const visibleDays = currentMonthData.days.slice(startDayIndex, endDayIndex);

  // Calculate padding for the first visible row
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
                  {currentStats.totalCheckins}
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
                  {currentStats.avgBattery}/5
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

// --- Outer Component (Data Fetching) ---

const enhance = withObservables([], () => {
  // Observe all social battery logs for the current year
  // This ensures that whenever a log is added/removed/updated, the component re-renders
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1).getTime();
  const endOfYear = new Date(currentYear, 11, 31).getTime();

  return {
    logs: database.get<SocialBatteryLog>('social_battery_logs')
      .query(
        Q.where('timestamp', Q.gte(startOfYear)),
        Q.where('timestamp', Q.lte(endOfYear))
      )
      .observe(),
  };
});

export const YearInMoonsWidget = enhance(YearInMoonsWidgetContent);
